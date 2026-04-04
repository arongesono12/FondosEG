import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import { markAgentTransferPaidOut } from '@/lib/server/financial-operations';

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'gestor');

    const body = (await request.json()) as { transfer_code?: string; transfer_id?: string };
    const code = (body.transfer_code || '').trim().toUpperCase();
    const transferId = body.transfer_id;

    if (!code && !transferId) {
      return NextResponse.json({ success: false, error: 'Código o ID requerido' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: transfer, error } = await adminClient
      .from('transfers')
      .select('*')
      .eq(transferId ? 'id' : 'transfer_code', transferId || code)
      .single();

    if (error || !transfer) {
      return NextResponse.json({ success: false, error: 'Transferencia no encontrada' }, { status: 404 });
    }

    if (!['created', 'available_for_pickup'].includes(transfer.status)) {
      return NextResponse.json({ success: false, error: 'La transferencia no está disponible para pago' }, { status: 409 });
    }

    const result = await markAgentTransferPaidOut(transfer.id, profile.id);
    return NextResponse.json({ success: true, transfer: result.transfer });
  } catch (err) {
    console.error('[POST /api/transfers/payout]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
