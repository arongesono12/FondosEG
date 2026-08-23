import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import type { Transfer } from '@/types';
import { isAdminRole } from '@/lib/roles';

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

    if (isAdminRole(profile.role)) {
      const { data, error } = await adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    if (profile.role === 'gestor') {
      const { data, error } = await adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name)')
        .or(`agent_id.eq.${profile.id},paid_out_by.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    // cliente: ve las transferencias que emitió y los envíos de gestor que
    // fueron acreditados a su billetera mediante receiver_user_id.
    const { data: clientTransfers } = await adminClient
      .from('transfers')
      .select('*')
      .or(`sender_id.eq.${profile.id},receiver_user_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: walletTransfers } = await adminClient
      .from('wallet_transfers')
      .select('*')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    interface WalletRecord { 
      id: string | number; 
      sender_id: string; 
      sender_name: string; 
      sender_phone: string; 
      receiver_name: string; 
      receiver_phone: string; 
      amount: number; 
      currency: string; 
      status: string; 
      notes?: string; 
      created_at: string; 
      confirmed_at?: string; 
      cancelled_at?: string; 
    }

    const mappedWallet: Transfer[] = (walletTransfers as unknown as WalletRecord[] || []).map((t) => ({
      id: String(t.id),
      transfer_code: `WT-${String(t.id).slice(0, 8)}`,
      transfer_type: 'client',
      sender_id: t.sender_id,
      sender_name: t.sender_name || 'Desconocido',
      sender_phone: t.sender_phone || '',
      receiver_name: t.receiver_name || 'Desconocido',
      receiver_phone: t.receiver_phone || '',
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
