import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSuperAdmin } from '@/lib/server/authz';
import type { UserRole } from '@/types';

type ManagedRole = Extract<UserRole, 'gestor' | 'cliente'>;

type ManagedUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: ManagedRole;
  is_active: boolean;
  created_at: string;
};

type TransferMovement = {
  id: string;
  transfer_code: string;
  sender_name: string;
  receiver_name: string;
  destination_city: string;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  created_at: string;
};

type WalletMovement = {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  receiver_name: string;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  created_at: string;
};

type BalanceMovement = {
  id: string;
  type: string;
  amount: number | string | null;
  previous_balance: number | string | null;
  new_balance: number | string | null;
  description?: string | null;
  created_at: string;
};

type ActivityMovement = {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type SupportMovement = {
  id: string;
  request_type?: string | null;
  message: string;
  status?: string | null;
  created_at: string;
};

function formatActionTitle(action: string): string {
  switch (action) {
    case 'create_client_transfer':
      return 'Transferencia creada';
    case 'create_agent':
      return 'Cuenta creada';
    case 'topup_agent_balance':
      return 'Recarga de saldo';
    case 'reset_agent_balance':
      return 'Saldo reiniciado';
    case 'toggle_agent_status':
      return 'Estado actualizado';
    default:
      return action.replace(/_/g, ' ');
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireProfile();
    requireSuperAdmin(profile);

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '60', 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 60, 20), 200);
    const sourceLimit = limit + 1;
    const adminClient = createAdminClient();

    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at')
      .eq('id', id)
      .in('role', ['gestor', 'cliente'])
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const [
      { data: transfersAsAgent },
      { data: transfersAsSender },
      { data: transfersAsReceiver },
      { data: walletAsSender },
      { data: walletAsReceiver },
      { data: balanceTransactions },
      { data: activityLogs },
      { data: supportMessages },
    ] = await Promise.all([
      adminClient
        .from('transfers')
        .select('id, transfer_code, sender_name, receiver_name, destination_city, amount, currency, status, created_at')
        .eq('agent_id', id)
        .order('created_at', { ascending: false })
        .limit(sourceLimit),
      adminClient
        .from('transfers')
        .select('id, transfer_code, sender_name, receiver_name, destination_city, amount, currency, status, created_at')
        .eq('sender_id', id)
        .order('created_at', { ascending: false })
        .limit(sourceLimit),
      adminClient
        .from('transfers')
        .select('id, transfer_code, sender_name, receiver_name, destination_city, amount, currency, status, created_at')
        .eq('receiver_user_id', id)
        .order('created_at', { ascending: false })
        .limit(sourceLimit),
      adminClient
        .from('wallet_transfers')
        .select('id, sender_id, receiver_id, sender_name, receiver_name, amount, currency, status, created_at')
        .eq('sender_id', id)
        .order('created_at', { ascending: false })
        .limit(sourceLimit),
      adminClient
        .from('wallet_transfers')
        .select('id, sender_id, receiver_id, sender_name, receiver_name, amount, currency, status, created_at')
        .eq('receiver_id', id)
        .order('created_at', { ascending: false })
        .limit(sourceLimit),
      adminClient
        .from('balance_transactions')
        .select('id, type, amount, previous_balance, new_balance, description, created_at')
        .eq('agent_id', id)
        .order('created_at', { ascending: false })
        .limit(sourceLimit),
      adminClient
        .from('activity_logs')
        .select('id, action, entity_type, entity_id, metadata, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(sourceLimit),
      adminClient
        .from('support_messages')
        .select('id, request_type, message, status, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(sourceLimit),
    ]);

    const allMovements = [
      ...((transfersAsAgent ?? []) as TransferMovement[]).map((item) => ({
        id: `transfer-agent-${item.id}`,
        kind: 'transfer' as const,
        title: 'Transferencia gestionada',
        description: `${item.transfer_code} · ${item.sender_name} -> ${item.receiver_name} · ${item.destination_city}`,
        created_at: item.created_at,
        amount: Number(item.amount ?? 0),
        currency: item.currency || 'XAF',
        status: item.status,
        reference_id: item.id,
      })),
      ...((transfersAsSender ?? []) as TransferMovement[]).map((item) => ({
        id: `transfer-sender-${item.id}`,
        kind: 'transfer' as const,
        title: 'Transferencia creada',
        description: `${item.transfer_code} · ${item.sender_name} -> ${item.receiver_name} · ${item.destination_city}`,
        created_at: item.created_at,
        amount: Number(item.amount ?? 0),
        currency: item.currency || 'XAF',
        status: item.status,
        reference_id: item.id,
      })),
      ...((transfersAsReceiver ?? []) as TransferMovement[]).map((item) => ({
        id: `transfer-receiver-${item.id}`,
        kind: 'transfer' as const,
        title: 'Transferencia recibida',
        description: `${item.transfer_code} · ${item.sender_name} -> ${item.receiver_name} · ${item.destination_city}`,
        created_at: item.created_at,
        amount: Number(item.amount ?? 0),
        currency: item.currency || 'XAF',
        status: item.status,
        reference_id: item.id,
      })),
      ...((walletAsSender ?? []) as WalletMovement[]).map((item) => ({
        id: `wallet-sender-${item.id}`,
        kind: 'wallet_transfer' as const,
        title: 'Billetera enviada',
        description: `${item.sender_name} -> ${item.receiver_name}`,
        created_at: item.created_at,
        amount: Number(item.amount ?? 0),
        currency: item.currency || 'XAF',
        status: item.status,
        reference_id: item.id,
      })),
      ...((walletAsReceiver ?? []) as WalletMovement[]).map((item) => ({
        id: `wallet-receiver-${item.id}`,
        kind: 'wallet_transfer' as const,
        title: 'Billetera recibida',
        description: `${item.sender_name} -> ${item.receiver_name}`,
        created_at: item.created_at,
        amount: Number(item.amount ?? 0),
        currency: item.currency || 'XAF',
        status: item.status,
        reference_id: item.id,
      })),
      ...((balanceTransactions ?? []) as BalanceMovement[]).map((item) => ({
        id: `balance-${item.id}`,
        kind: 'balance_transaction' as const,
        title: `Movimiento de saldo: ${item.type}`,
        description:
          item.description ||
          `Saldo ${Number(item.previous_balance ?? 0)} -> ${Number(item.new_balance ?? 0)}`,
        created_at: item.created_at,
        amount: Number(item.amount ?? 0),
        currency: 'XAF',
        reference_id: item.id,
      })),
      ...((activityLogs ?? []) as ActivityMovement[]).map((item) => ({
        id: `activity-${item.id}`,
        kind: 'activity' as const,
        title: formatActionTitle(item.action),
        description: item.entity_type
          ? `${item.entity_type}${item.entity_id ? ` · ${item.entity_id}` : ''}`
          : 'Acción registrada en bitácora',
        created_at: item.created_at,
        reference_id: item.entity_id || item.id,
      })),
      ...((supportMessages ?? []) as SupportMovement[]).map((item) => ({
        id: `support-${item.id}`,
        kind: 'support' as const,
        title: item.request_type ? `Soporte: ${item.request_type}` : 'Solicitud de soporte',
        description: item.message,
        created_at: item.created_at,
        status: item.status || null,
        reference_id: item.id,
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const hasMore = allMovements.length > limit;
    const movements = allMovements.slice(0, limit);

    const latestMovement = movements[0];

    return NextResponse.json({
      user: {
        ...(user as ManagedUserRow),
        movement_count: movements.length,
        last_movement_at: latestMovement?.created_at || null,
        last_movement_label: latestMovement?.title || null,
      },
      movements,
      hasMore,
    });
  } catch (err) {
    console.error('[GET /api/staff/users/[id]]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
