import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import { markAgentTransferPaidOut } from '@/lib/server/financial-operations';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import { saveInternalNotification } from '@/lib/server/notification-outbox';

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

    try {
      const paidTransfer = result.transfer as Record<string, unknown>;
      const originAgentId = String(paidTransfer.agent_id || transfer.agent_id || '');
      if (originAgentId) {
        const { data: originAgent } = await adminClient
          .from('users')
          .select('id, name, phone')
          .eq('id', originAgentId)
          .single();

        await saveInternalNotification({
          transferId: String(paidTransfer.id),
          userId: originAgentId,
          phone: originAgent?.phone || String(paidTransfer.sender_phone || transfer.sender_phone || ''),
          priority: 'high',
          message: [
            `FondosEG: La transferencia ${paidTransfer.transfer_code || transfer.transfer_code} fue retirada correctamente.`,
            `Beneficiario: ${paidTransfer.receiver_name || transfer.receiver_name}.`,
            `Monto: ${paidTransfer.amount || transfer.amount} ${paidTransfer.currency || transfer.currency}.`,
            `Gestor pagador: ${profile.name || 'Gestor autorizado'}.`,
            'Estado actual: pagada.',
          ].join('\n'),
        });
      }
    } catch (notificationErr) {
      console.error('Failed to create payout notification for origin agent:', notificationErr);
    }

    try {
      const paidTransfer = result.transfer as Record<string, unknown>;
      await emitWebhookEvent(
        {
          eventType: 'transfer.paid_out',
          payload: {
            transfer_id: String(paidTransfer.id),
            transfer_code: String(paidTransfer.transfer_code),
            amount: Number(paidTransfer.amount),
            currency: String(paidTransfer.currency),
            status: String(paidTransfer.status),
            sender_name: paidTransfer.sender_name ?? null,
            sender_phone: paidTransfer.sender_phone ?? null,
            receiver_name: paidTransfer.receiver_name ?? null,
            receiver_phone: paidTransfer.receiver_phone ?? null,
            destination_city: paidTransfer.destination_city ?? null,
            paid_out_at: paidTransfer.paid_out_at ?? null,
            paid_out_by: paidTransfer.paid_out_by ?? profile.id,
            source: 'dashboard',
          },
        },
        10
      );
    } catch (webhookErr) {
      console.error('Webhook dispatch failed after transfer payout:', webhookErr);
    }

    return NextResponse.json({ success: true, transfer: result.transfer });
  } catch (err) {
    console.error('[POST /api/transfers/payout]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
