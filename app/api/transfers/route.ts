import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { createAgentTransferOperation } from '@/modules/transfers/application';
import type { Transfer, TransferFormData } from '@/types';
import { generateTransferCode } from '@/lib/utils';
import { queueTransferNotifications, processNotificationOutbox } from '@/lib/server/notification-outbox';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import { isAdminRole } from '@/lib/roles';
import { PAYMENT_REGULATION } from '@/lib/compliance';
import { assertComplianceInfrastructure, recordPaymentConsent } from '@/lib/server/compliance-events';
import { findRegisteredClientByPhone } from '@/lib/server/client-recipient';

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    if (isAdminRole(profile.role)) {
      const { data, error } = await adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name, phone)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    if (profile.role === 'gestor') {
      const { data, error } = await adminClient
        .from('transfers')
        .select('*')
        .or(`agent_id.eq.${profile.id},paid_out_by.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    // cliente: show own client transfers + wallet transfers mapped to Transfer
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

    const mappedWallet: Transfer[] = (walletTransfers || []).map((t: {
      id: string;
      sender_id: string;
      sender_name: string;
      sender_phone: string;
      receiver_name: string;
      receiver_phone: string;
      amount: number | string;
      currency?: string;
      status: string;
      notes?: string;
      created_at: string;
      confirmed_at?: string;
      cancelled_at?: string;
    }) => ({
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

    const all = ([...(clientTransfers || []), ...mappedWallet] as Transfer[]).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json(all.slice(0, limit));
  } catch (err) {
    console.error('[GET /api/transfers]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'gestor');

    const body = (await request.json()) as TransferFormData;
    if (!body.receiver_name || !body.receiver_phone || !body.amount || !body.destination_city) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }
    if (
      body.compliance_consent !== true ||
      body.disclosure_version !== PAYMENT_REGULATION.disclosureVersion
    ) {
      return NextResponse.json(
        { success: false, error: 'Debe revisar y aceptar la información previa del servicio de pago' },
        { status: 400 }
      );
    }
    await assertComplianceInfrastructure();

    const adminClient = createAdminClient();
    const registeredReceiver = await findRegisteredClientByPhone(adminClient, body.receiver_phone);
    const transferCode = generateTransferCode();
    const { transfer } = await createAgentTransferOperation({
      agentId: profile.id,
      actorUserId: profile.id,
      transferCode,
      senderName: body.sender_name,
      senderPhone: body.sender_phone,
      senderDocumentType: body.sender_document_type,
      senderDocumentNumber: body.sender_document_number,
      receiverName: body.receiver_name,
      receiverPhone: body.receiver_phone,
      receiverDocumentType: body.receiver_document_type,
      receiverDocumentNumber: body.receiver_document_number,
      destinationCity: body.destination_city,
      destinationCountry: body.destination_country,
      amount: Number(body.amount),
      currency: body.currency,
      notes: body.notes,
      receiverUserId: registeredReceiver?.id ?? null,
    });

    const typedTransfer = (transfer as unknown) as Transfer;

    await recordPaymentConsent({
      actorUserId: profile.id,
      transferId: typedTransfer.id,
      transferType: 'agent_transfer',
      amount: typedTransfer.amount,
      currency: typedTransfer.currency,
      feeAmount: typedTransfer.commission_amount ?? 0,
      beneficiaryName: typedTransfer.receiver_name,
      channel: 'dashboard',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent'),
    });

    // Enqueue notifications using the unified system.
    try {
      await queueTransferNotifications({
        transferId: typedTransfer.id,
        transferCode: typedTransfer.transfer_code,
        senderPhone: typedTransfer.sender_phone,
        receiverPhone: typedTransfer.receiver_phone,
        senderName: typedTransfer.sender_name,
        receiverName: typedTransfer.receiver_name,
        amount: typedTransfer.amount,
        currency: typedTransfer.currency,
        destinationCity: typedTransfer.destination_city,
        receiverUserId: typedTransfer.receiver_user_id ?? registeredReceiver?.id ?? null,
        settledToWallet: Boolean(typedTransfer.receiver_user_id && typedTransfer.wallet_credited_at),
      });

      // Background process the outbox immediately.
      // In Next.js App Router, we just await it to ensure it finishes or use a background pattern.
      // For simplicity and immediate fix, we'll await it here since it's just 2 messages.
      await processNotificationOutbox(5);
    } catch (notifErr) {
      console.error('Notification queuing/processing failed but transfer is created:', notifErr);
    }

    try {
      await emitWebhookEvent(
        {
          eventType: 'transfer.created',
          payload: {
            transfer_id: typedTransfer.id,
            transfer_code: typedTransfer.transfer_code,
            amount: typedTransfer.amount,
            currency: typedTransfer.currency,
            status: typedTransfer.status,
            sender_name: typedTransfer.sender_name,
            sender_phone: typedTransfer.sender_phone,
            receiver_name: typedTransfer.receiver_name,
            receiver_phone: typedTransfer.receiver_phone,
            destination_city: typedTransfer.destination_city,
            destination_country: typedTransfer.destination_country ?? null,
            source: 'dashboard',
          },
        },
        10
      );
    } catch (webhookErr) {
      console.error('Webhook dispatch failed but transfer is created:', webhookErr);
    }

    return NextResponse.json({ success: true, transfer: typedTransfer });
  } catch (err) {
    console.error('[POST /api/transfers]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    if (err instanceof Error && err.message) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
