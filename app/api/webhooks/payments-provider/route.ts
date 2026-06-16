import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitWebhookEvent, type FondosEGWebhookEvent } from '@/lib/server/webhook-outbox';
import { updateRentalPaymentStatusOperation } from '@/lib/server/property-operations';
import {
  getProviderName,
  normalizeProviderStatus,
  verifyProviderWebhookSignature,
  type RentalPaymentStatus,
} from '@/lib/server/payments-provider';

/**
 * Inbound webhook from the external payments app. Verifies the HMAC signature,
 * deduplicates by event id, updates the matching rental payment and fans the
 * status change out to FondosEG webhook subscribers.
 *
 * Expected body: { id, type, data: { reference|payment_id, status, ... } }
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-payments-timestamp');
  const signature = request.headers.get('x-payments-signature');

  if (!process.env.PAYMENTS_PROVIDER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });
  }

  if (!verifyProviderWebhookSignature(timestamp, rawBody, signature)) {
    return NextResponse.json({ error: 'Firma invalida' }, { status: 401 });
  }

  let event: { id?: string; type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const provider = getProviderName();
  const eventId = String(event.id || '').trim();
  const eventType = String(event.type || '').trim() || 'payment.updated';
  const data = event.data ?? {};

  if (!eventId) {
    return NextResponse.json({ error: 'event id requerido' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Idempotent record of the inbound event. A unique (provider, event_id)
  // constraint means a duplicate insert tells us we already processed it.
  const { error: insertError } = await adminClient.from('payment_provider_events').insert({
    provider,
    event_id: eventId,
    event_type: eventType,
    signature_valid: true,
    payload: event,
    status: 'received',
  });

  if (insertError) {
    if (insertError.code === '23505') {
      // Duplicate delivery — acknowledge without reprocessing.
      return NextResponse.json({ success: true, duplicate: true });
    }
    console.error('Provider event log failed:', insertError);
    return NextResponse.json({ error: 'No se pudo registrar el evento' }, { status: 500 });
  }

  const reference = String(data.reference || data.payment_id || '').trim();
  const providerPaymentId = String(data.id || data.charge_id || data.provider_payment_id || '').trim();
  const status: RentalPaymentStatus = normalizeProviderStatus(data.status);

  try {
    // Locate the payment by our reference (rental_payment id) or provider id.
    let paymentQuery = adminClient
      .from('rental_payments')
      .select('id, rental_id, property_id, owner_id, tenant_id, amount, currency, period, provider, status')
      .limit(1);

    paymentQuery = reference
      ? paymentQuery.eq('id', reference)
      : paymentQuery.eq('provider_payment_id', providerPaymentId);

    const { data: payment } = await paymentQuery.maybeSingle();

    if (!payment) {
      await markEvent(adminClient, eventId, provider, 'ignored', null, 'No se encontró el pago');
      return NextResponse.json({ success: true, matched: false });
    }

    const { payment: updated } = await updateRentalPaymentStatusOperation({
      paymentId: String(payment.id),
      status,
      providerPaymentId: providerPaymentId || null,
      providerReference: typeof data.reference === 'string' ? data.reference : null,
      failureReason: typeof data.failure_reason === 'string' ? data.failure_reason : null,
      metadata: { provider_event_id: eventId, provider_event_type: eventType },
    });

    await markEvent(adminClient, eventId, provider, 'processed', String(payment.id), null);

    // Fan out the status change to FondosEG subscribers (no 'pending' event exists).
    if (status !== 'pending') {
      const fanoutEvent = `rental_payment.${status}` as FondosEGWebhookEvent;
      try {
        await emitWebhookEvent(
        {
          eventType: fanoutEvent,
          payload: {
            payment_id: updated.id,
            rental_id: updated.rental_id,
            property_id: updated.property_id,
            amount: Number(updated.amount),
            currency: updated.currency,
            period: updated.period,
            status: updated.status,
            provider: updated.provider,
            provider_payment_id: updated.provider_payment_id ?? null,
            source: 'payments_provider',
          },
        },
        10
        );
      } catch (webhookError) {
        console.error('Fan-out webhook failed after provider event:', webhookError);
      }
    }

    return NextResponse.json({ success: true, payment_id: updated.id, status: updated.status });
  } catch (error) {
    console.error('Provider webhook processing failed:', error);
    await markEvent(
      adminClient,
      eventId,
      provider,
      'failed',
      null,
      error instanceof Error ? error.message : 'Error desconocido'
    );
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 });
  }
}

async function markEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  eventId: string,
  provider: string,
  status: 'processed' | 'ignored' | 'failed',
  rentalPaymentId: string | null,
  errorMessage: string | null
) {
  await adminClient
    .from('payment_provider_events')
    .update({
      status,
      rental_payment_id: rentalPaymentId,
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq('provider', provider)
    .eq('event_id', eventId);
}
