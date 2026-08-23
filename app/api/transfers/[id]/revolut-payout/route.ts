import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireProfile } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminRole } from '@/lib/roles';
import {
  createRevolutPayoutLink,
  RevolutApiError,
  RevolutConfigError,
} from '@/lib/server/revolut';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import type { Transfer } from '@/types';

export const runtime = 'nodejs';

function canManageRevolutPayout(profile: { id: string; role: string }, transfer: Transfer) {
  return isAdminRole(profile.role) || (profile.role === 'gestor' && transfer.agent_id === profile.id);
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireProfile();
    const { id } = await context.params;
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('transfers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Transferencia no encontrada' }, { status: 404 });
    }

    const transfer = data as Transfer;
    if (!canManageRevolutPayout(profile, transfer)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    if (transfer.transfer_type === 'client') {
      return NextResponse.json(
        { success: false, error: 'Revolut solo puede activarse sobre envíos de gestor.' },
        { status: 409 }
      );
    }

    // El envío a un cliente registrado ya se liquidó contra su billetera.
    // Abrirle además un payout externo pagaría el mismo dinero dos veces.
    if (transfer.receiver_user_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Este envío se acreditó en la billetera del beneficiario. Debe retirarlo él desde la aplicación.',
        },
        { status: 409 }
      );
    }

    if (!['created', 'available_for_pickup'].includes(transfer.status)) {
      return NextResponse.json(
        { success: false, error: 'La transferencia no está disponible para payout externo.' },
        { status: 409 }
      );
    }

    if (transfer.payout_provider === 'revolut' && transfer.payout_url) {
      return NextResponse.json({ success: true, transfer });
    }

    const payout = await createRevolutPayoutLink({
      requestId: transfer.payout_request_id || transfer.id,
      counterpartyName: transfer.receiver_name,
      amount: Number(transfer.amount),
      currency: transfer.currency,
      reference: transfer.transfer_code,
    });

    const { data: updatedTransfer, error: updateError } = await adminClient
      .from('transfers')
      .update({
        payout_provider: 'revolut',
        payout_reference_id: payout.id,
        payout_url: payout.url ?? null,
        payout_state: payout.state,
        payout_request_id: payout.request_id,
        payout_expires_at: payout.expiry_date ?? null,
        payout_methods: payout.payout_methods,
        payout_raw: payout,
      })
      .eq('id', transfer.id)
      .select('*')
      .single();

    if (updateError || !updatedTransfer) {
      return NextResponse.json(
        { success: false, error: updateError?.message || 'No se pudo guardar el payout de Revolut' },
        { status: 500 }
      );
    }

    try {
      await emitWebhookEvent(
        {
          eventType: 'transfer.revolut_payout_link_created',
          payload: {
            transfer_id: updatedTransfer.id,
            transfer_code: updatedTransfer.transfer_code,
            amount: Number(updatedTransfer.amount),
            currency: updatedTransfer.currency,
            status: updatedTransfer.status,
            payout_provider: 'revolut',
            payout_reference_id: payout.id,
            payout_state: payout.state,
            payout_url: payout.url ?? null,
            payout_expires_at: payout.expiry_date ?? null,
            source: 'dashboard',
          },
        },
        10
      );
    } catch (webhookErr) {
      console.error('Webhook dispatch failed after Revolut payout link creation:', webhookErr);
    }

    return NextResponse.json({ success: true, transfer: updatedTransfer as Transfer });
  } catch (err) {
    console.error('[POST /api/transfers/[id]/revolut-payout]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    if (err instanceof RevolutConfigError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 503 });
    }
    if (err instanceof RevolutApiError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 502 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
