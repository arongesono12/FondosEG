import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile } from '@/lib/server/authz';
import type { Transfer } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50);

    if (query.length < 3) {
      return NextResponse.json([]);
    }

    if (profile.role === 'admin' || profile.role === 'gestor') {
      let baseQuery = adminClient.from('transfers').select('*, agent:users!transfers_agent_id_fkey(name)');

      if (profile.role === 'gestor') {
        baseQuery = baseQuery.eq('agent_id', profile.id);
      }

      const { data, error } = await baseQuery
        .or(
          `transfer_code.ilike.%${query}%,sender_name.ilike.%${query}%,receiver_name.ilike.%${query}%,destination_city.ilike.%${query}%`
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    // cliente: search in own transfers (transfers.sender_id) and wallet_transfers
    const { data: transfers } = await adminClient
      .from('transfers')
      .select('*')
      .eq('sender_id', profile.id)
      .or(`transfer_code.ilike.%${query}%,receiver_name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: walletTransfers } = await adminClient
      .from('wallet_transfers')
      .select('*')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    const mappedWallet: Transfer[] = (walletTransfers || [])
      .filter((t: any) => {
        const token = query.toLowerCase();
        return (
          String(t.sender_name || '').toLowerCase().includes(token) ||
          String(t.receiver_name || '').toLowerCase().includes(token) ||
          String(t.sender_phone || '').includes(query) ||
          String(t.receiver_phone || '').includes(query) ||
          String(t.verification_code || '').includes(query)
        );
      })
      .map((t: any) => ({
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
      }));

    const all = ([...(transfers || []), ...mappedWallet] as Transfer[]).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json(all.slice(0, limit));
  } catch (err) {
    console.error('[GET /api/transfers/search]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

