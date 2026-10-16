import { randomUUID } from 'crypto';
import {
  decryptWebhookSecret,
  isWebhookEncryptionConfigured,
  signWebhookPayload,
} from '@/lib/server/webhook-security';
import { createAdminClient } from '@/lib/supabase/admin';
import { scheduleOutboxProcessing } from '@/lib/server/outbox-worker';

export type FondosEGWebhookEvent =
  | 'transfer.created'
  | 'transfer.paid_out'
  | 'transfer.revolut_payout_link_created'
  | 'wallet_transfer.confirmed'
  | 'rental_payment.created'
  | 'rental_payment.processing'
  | 'rental_payment.paid'
  | 'rental_payment.failed'
  | 'rental_payment.refunded'
  | 'rental_payment.cancelled'
  | 'payment_request.paid'
  | 'payment_request.cancelled'
  | 'payment_request.payment_failed';

interface QueueWebhookEventInput {
  eventType: FondosEGWebhookEvent;
  payload: Record<string, unknown>;
  /**
   * Restringe la entrega a las suscripciones de este usuario. Obligatorio
   * para eventos con datos de un comercio concreto: sin él, cualquier
   * suscriptor del tipo de evento recibiría los cobros de otro comercio.
   */
  ownerUserId?: string;
}

interface WebhookDispatchErrorDetails {
  responseStatus?: number;
  responseBody?: string;
}

class WebhookDispatchError extends Error {
  responseStatus?: number;
  responseBody?: string;

  constructor(message: string, details: WebhookDispatchErrorDetails = {}) {
    super(message);
    this.name = 'WebhookDispatchError';
    this.responseStatus = details.responseStatus;
    this.responseBody = details.responseBody;
  }
}

export async function queueWebhookEvent(input: QueueWebhookEventInput): Promise<number> {
  const adminClient = createAdminClient();
  let subscriptionsQuery = adminClient
    .from('webhook_subscriptions')
    .select('id')
    .eq('status', 'active')
    .contains('event_types', [input.eventType]);

  if (input.ownerUserId) {
    subscriptionsQuery = subscriptionsQuery.eq('user_id', input.ownerUserId);
  }

  const { data: subscriptions, error } = await subscriptionsQuery;

  if (error) {
    throw new Error(error.message);
  }

  if (!subscriptions?.length) {
    return 0;
  }

  const eventId = randomUUID();
  const createdAt = new Date().toISOString();
  const envelope = {
    id: eventId,
    event: input.eventType,
    created_at: createdAt,
    data: input.payload,
  };

  const { error: insertError } = await adminClient.from('webhook_deliveries').insert(
    subscriptions.map((subscription) => ({
      subscription_id: subscription.id,
      event_id: eventId,
      event_type: input.eventType,
      request_body: envelope,
      status: 'pending',
      next_attempt_at: createdAt,
      max_attempts: 5,
    }))
  );

  if (insertError) {
    throw new Error(insertError.message);
  }

  return subscriptions.length;
}

/**
 * Registra el evento en `webhook_deliveries` y programa su entrega después de
 * responder. La fila en la base de datos es lo que garantiza la entrega: si el
 * proceso termina antes, el worker `/api/outbox/process` la recoge.
 *
 * Antes este método entregaba los webhooks dentro de la petición, de modo que
 * un endpoint de cliente lento retrasaba la confirmación de la operación.
 */
export async function emitWebhookEvent(
  input: QueueWebhookEventInput
): Promise<{ queued: number }> {
  const queued = await queueWebhookEvent(input);
  if (queued) scheduleOutboxProcessing();
  return { queued };
}

/** Plazo máximo de respuesta de un endpoint de webhook. */
const WEBHOOK_TIMEOUT_MS = 10_000;

type ClaimedDelivery = {
  id: string;
  subscription_id: string;
  event_id: string;
  event_type: string;
  request_body: unknown;
  attempt_count: number;
  max_attempts: number;
};

type SubscriptionTarget = {
  id: string;
  target_url: string;
  status: string;
  signing_secret_encrypted: string;
};

/**
 * Entrega los webhooks pendientes. Los trabajos se reclaman de forma atómica
 * (`claim_webhook_deliveries`, FOR UPDATE SKIP LOCKED): dos workers no
 * entregan la misma fila. `attempt_count` ya viene incrementado por la
 * reclamación.
 */
export async function processWebhookDeliveries(limit: number = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
  retried: number;
}> {
  // Sin la clave, cada intento fallaría al descifrar el secreto y quemaría sus
  // reintentos hasta marcar la entrega como `failed`: el evento se perdería.
  // Se dejan en cola hasta que el despliegue se corrija.
  if (!isWebhookEncryptionConfigured()) {
    console.error('Webhooks en pausa: WEBHOOK_ENCRYPTION_KEY ausente o inválida. Las entregas siguen en cola.');
    return { processed: 0, sent: 0, failed: 0, retried: 0 };
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc('claim_webhook_deliveries', { p_limit: limit });
  if (error) {
    throw new Error(error.message);
  }

  const jobs = (data ?? []) as ClaimedDelivery[];
  if (!jobs.length) {
    return { processed: 0, sent: 0, failed: 0, retried: 0 };
  }

  const subscriptionIds = [...new Set(jobs.map((job) => job.subscription_id))];
  const { data: subscriptionRows, error: subscriptionsError } = await adminClient
    .from('webhook_subscriptions')
    .select('id, target_url, status, signing_secret_encrypted')
    .in('id', subscriptionIds);
  if (subscriptionsError) {
    // Se liberan los leases para que otro intento los retome sin esperar.
    await adminClient.from('webhook_deliveries').update({ locked_until: null }).in('id', jobs.map((job) => job.id));
    throw new Error(subscriptionsError.message);
  }
  const subscriptions = new Map(((subscriptionRows ?? []) as SubscriptionTarget[]).map((row) => [row.id, row]));

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const job of jobs) {
    const nowIso = new Date().toISOString();
    const subscription = subscriptions.get(job.subscription_id);

    if (!subscription || subscription.status !== 'active') {
      await adminClient
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          locked_until: null,
          error_message: 'Subscription not active',
          processed_at: nowIso,
        })
        .eq('id', job.id);
      failed += 1;
      continue;
    }

    const requestBody = JSON.stringify(job.request_body);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    try {
      const secret = decryptWebhookSecret(subscription.signing_secret_encrypted);
      const signature = signWebhookPayload(secret, timestamp, requestBody);
      const response = await fetch(subscription.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FondosEG-Webhooks/1.0',
          'X-FondosEG-Webhook-Id': job.event_id,
          'X-FondosEG-Webhook-Event': job.event_type,
          'X-FondosEG-Webhook-Timestamp': timestamp,
          'X-FondosEG-Webhook-Signature': `v1=${signature}`,
        },
        body: requestBody,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await adminClient
          .from('webhook_deliveries')
          .update({
            status: 'sent',
            locked_until: null,
            response_status: response.status,
            response_body: responseBody.slice(0, 2000),
            processed_at: nowIso,
            delivered_at: nowIso,
            error_message: null,
          })
          .eq('id', job.id);

        await adminClient
          .from('webhook_subscriptions')
          .update({ last_delivery_at: nowIso, updated_at: nowIso })
          .eq('id', job.subscription_id);

        sent += 1;
        continue;
      }

      throw new WebhookDispatchError(`Webhook destination responded with ${response.status}`, {
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 2000),
      });
    } catch (error) {
      const attemptCount = Number(job.attempt_count || 1);
      const maxAttempts = Number(job.max_attempts || 5);
      const message =
        error instanceof Error && error.name === 'TimeoutError'
          ? `Webhook destination did not respond within ${WEBHOOK_TIMEOUT_MS} ms`
          : error instanceof Error
            ? error.message
            : 'Webhook delivery failed';
      const responseStatus = error instanceof WebhookDispatchError ? error.responseStatus : null;
      const responseBody = error instanceof WebhookDispatchError ? error.responseBody : null;

      if (attemptCount >= maxAttempts) {
        await adminClient
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            locked_until: null,
            processed_at: nowIso,
            error_message: message,
            response_status: responseStatus,
            response_body: responseBody,
          })
          .eq('id', job.id);
        failed += 1;
      } else {
        const nextAttemptAt = new Date(Date.now() + getRetryDelayMs(attemptCount)).toISOString();
        await adminClient
          .from('webhook_deliveries')
          .update({
            status: 'retrying',
            locked_until: null,
            processed_at: nowIso,
            next_attempt_at: nextAttemptAt,
            error_message: message,
            response_status: responseStatus,
            response_body: responseBody,
          })
          .eq('id', job.id);
        retried += 1;
      }
    }
  }

  return {
    processed: jobs.length,
    sent,
    failed,
    retried,
  };
}

function getRetryDelayMs(attemptCount: number): number {
  const scheduleSeconds = [30, 120, 600, 1800];
  return (scheduleSeconds[Math.min(attemptCount - 1, scheduleSeconds.length - 1)] || 1800) * 1000;
}
