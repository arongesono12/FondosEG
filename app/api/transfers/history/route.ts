import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import { isAdminRole } from '@/lib/roles';
import type { Transfer } from '@/types';

/**
 * Historial paginado con búsqueda y filtros en el servidor.
 *
 * La pantalla de historial cargaba las 150 operaciones más recientes y filtraba
 * en el navegador: una operación anterior parecía no existir. Aquí la búsqueda
 * recorre todo el alcance del usuario y la paginación usa un cursor estable
 * (created_at, id) descendente, sin saltos ni duplicados al insertar filas.
 */

type StatusFilter = 'all' | 'completed' | 'created' | 'cancelled';

// Mismas reglas que `lib/financial.ts` (isTransferCompleted / isTransferPending).
const TRANSFER_STATUSES: Record<Exclude<StatusFilter, 'all'>, string[]> = {
  completed: ['completed', 'paid_out'],
  created: ['created', 'pending', 'available_for_pickup'],
  cancelled: ['cancelled', 'expired'],
};
const WALLET_STATUSES: Record<Exclude<StatusFilter, 'all'>, string[]> = {
  completed: ['confirmed'],
  created: ['pending'],
  cancelled: ['cancelled', 'expired'],
};

const TRANSFER_SEARCH_COLUMNS = ['transfer_code', 'sender_name', 'sender_phone', 'receiver_name', 'receiver_phone', 'destination_city'];
const WALLET_SEARCH_COLUMNS = ['sender_name', 'sender_phone', 'receiver_name', 'receiver_phone'];

type Cursor = { createdAt: string; id: string };

type WalletTransferRow = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  amount: number | string;
  currency?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
};

// Columnas explícitas: nunca `verification_code`.
const WALLET_COLUMNS = 'id, sender_id, sender_name, sender_phone, receiver_name, receiver_phone, amount, currency, status, notes, created_at, confirmed_at, cancelled_at';

/** Elimina los caracteres con significado en la sintaxis de filtros de PostgREST. */
function sanitizeSearch(value: string | null): string {
  return (value ?? '').replace(/[,()"'\\:*%]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function parseDay(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null;
}

function encodeCursor(item: { created_at: string; id: string }): string {
  return Buffer.from(JSON.stringify({ createdAt: item.created_at, id: item.id })).toString('base64url');
}

// El cursor conserva el timestamp tal como lo devuelve PostgreSQL: pasarlo por
// `Date` lo truncaría a milisegundos y el filtro `lt` saltaría filas con
// microsegundos intermedios.
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/;

/** Microsegundos desde epoch; `Date.parse` sólo llega a milisegundos. */
function toMicros(timestamp: string): number {
  const match = TIMESTAMP_PATTERN.exec(timestamp);
  if (!match) return Date.parse(timestamp) * 1000;
  const [, base, fraction = '', zone] = match;
  const offset = zone === 'Z' ? 'Z' : zone.length === 3 ? `${zone}:00` : zone.includes(':') ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  return Date.parse(`${base.replace(' ', 'T')}${offset}`) * 1000 + Number(fraction.padEnd(6, '0'));
}

function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof parsed.createdAt !== 'string' || !TIMESTAMP_PATTERN.test(parsed.createdAt)) return null;
    if (typeof parsed.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id)) return null;
    return { createdAt: parsed.createdAt, id: parsed.id.toLowerCase() };
  } catch {
    return null;
  }
}

/** Orden descendente por (created_at, id), el mismo que aplica PostgreSQL (uuid se compara como hex). */
function compareDesc(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  const byDate = toMicros(b.created_at) - toMicros(a.created_at);
  if (byDate !== 0) return byDate;
  const idA = a.id.toLowerCase();
  const idB = b.id.toLowerCase();
  return idB < idA ? -1 : idB > idA ? 1 : 0;
}

type Filters = {
  search: string;
  status: StatusFilter;
  from: string | null;
  to: string | null;
  cursor: Cursor | null;
};

// Tipado laxo a propósito: se aplica igual a consultas de `transfers` y `wallet_transfers`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<Q extends { or: any; in: any; gte: any; lt: any }>(
  query: Q,
  filters: Filters,
  statuses: Record<Exclude<StatusFilter, 'all'>, string[]>,
  searchColumns: string[],
): Q {
  let next = query;
  if (filters.search) {
    next = next.or(searchColumns.map((column) => `${column}.ilike."*${filters.search}*"`).join(','));
  }
  if (filters.status !== 'all') next = next.in('status', statuses[filters.status]);
  if (filters.from) next = next.gte('created_at', `${filters.from}T00:00:00.000Z`);
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    next = next.lt('created_at', end.toISOString());
  }
  if (filters.cursor) {
    const { createdAt, id } = filters.cursor;
    next = next.or(`created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id})`);
  }
  return next;
}

function mapWalletTransfer(t: WalletTransferRow): Transfer {
  return {
    id: t.id,
    transfer_code: `WT-${String(t.id).slice(0, 8)}`,
    transfer_type: 'client',
    sender_id: t.sender_id,
    sender_name: t.sender_name,
    sender_phone: t.sender_phone,
    receiver_name: t.receiver_name,
    receiver_phone: t.receiver_phone,
    destination_city: 'Billetera',
    destination_country: '',
    amount: Number(t.amount),
    currency: t.currency || 'XAF',
    status: t.status === 'confirmed' ? 'completed' : t.status === 'pending' ? 'created' : 'cancelled',
    notes: t.notes || undefined,
    created_at: t.created_at,
    completed_at: t.confirmed_at || undefined,
    cancelled_at: t.cancelled_at || undefined,
  } as Transfer;
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const rawStatus = searchParams.get('status');
    const filters: Filters = {
      search: sanitizeSearch(searchParams.get('q')),
      status: rawStatus === 'completed' || rawStatus === 'created' || rawStatus === 'cancelled' ? rawStatus : 'all',
      from: parseDay(searchParams.get('from')),
      to: parseDay(searchParams.get('to')),
      cursor: decodeCursor(searchParams.get('cursor')),
    };

    // Se pide una fila de más por fuente para saber si hay página siguiente.
    const pageSize = limit + 1;
    let items: Transfer[];

    if (isAdminRole(profile.role) || profile.role === 'gestor') {
      let query = adminClient
        .from('transfers')
        .select(isAdminRole(profile.role) ? '*, agent:users!transfers_agent_id_fkey(name, phone)' : '*');
      if (profile.role === 'gestor') {
        query = query.or(`agent_id.eq.${profile.id},paid_out_by.eq.${profile.id}`);
      }
      const { data, error } = await applyFilters(query, filters, TRANSFER_STATUSES, TRANSFER_SEARCH_COLUMNS)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize);
      if (error) throw error;
      items = (data ?? []) as unknown as Transfer[];
    } else {
      // Cliente: dos fuentes. Cada una se pagina con el mismo cursor y después
      // se fusionan; tomar las `limit` primeras de la unión es exacto porque
      // cada fuente aporta al menos `limit + 1` candidatas ordenadas.
      const [transfersResult, walletResult] = await Promise.all([
        applyFilters(
          adminClient.from('transfers').select('*').or(`sender_id.eq.${profile.id},receiver_user_id.eq.${profile.id}`),
          filters, TRANSFER_STATUSES, TRANSFER_SEARCH_COLUMNS,
        )
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(pageSize),
        applyFilters(
          adminClient.from('wallet_transfers').select(WALLET_COLUMNS).or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`),
          filters, WALLET_STATUSES, WALLET_SEARCH_COLUMNS,
        )
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(pageSize),
      ]);
      if (transfersResult.error) throw transfersResult.error;
      if (walletResult.error) throw walletResult.error;

      items = [
        ...((transfersResult.data ?? []) as unknown as Transfer[]),
        ...((walletResult.data ?? []) as unknown as WalletTransferRow[]).map(mapWalletTransfer),
      ].sort(compareDesc);
    }

    const page = items.slice(0, limit);
    const hasMore = items.length > limit;

    return NextResponse.json({
      items: page,
      nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : null,
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/transfers/history');
  }
}
