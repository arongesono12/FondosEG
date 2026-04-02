import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import type { Transfer } from '@/types';

function walletStatusToTransferStatus(status: string): Transfer['status'] {
  if (status === 'confirmed') return 'completed';
  if (status === 'pending') return 'created';
  return 'cancelled';
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50);

    if (profile.role === 'admin') {
      // Admin ve todas las transferencias
      const { data, error } = await adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    if (profile.role === 'gestor') {
      // Gestor ve TODAS las transferencias de todos los gestores
      const { data, error } = await adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    // cliente: solo ve sus propias transferencias
    const { data: clientTransfers } = await adminClient
      .from('transfers')
      .select('*')
      .eq('sender_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: walletTransfers } = await adminClient
      .from('wallet_transfers')
      .select('*')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    const mappedWallet: Transfer[] = (walletTransfers || []).map((t: any) => ({
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
      status: walletStatusToTransferStatus(t.status),
      notes: t.notes || undefined,
      created_at: t.created_at,
      completed_at: t.confirmed_at || undefined,
      cancelled_at: t.cancelled_at || undefined,
    }));

    const all = ([...(clientTransfers || []), ...mappedWallet] as Transfer[]).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json(all.slice(0, limit));
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/recent-transfers');
  }
}
