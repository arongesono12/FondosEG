import { randomUUID } from 'crypto';
import { decryptWebhookSecret, signWebhookPayload } from '@/lib/server/webhook-security';
import { createAdminClient } from '@/lib/supabase/admin';

export type FondosEGWebhookEvent =
  | 'transfer.created'
  | 'transfer.paid_out'
  | 'transfer.revolut_payout_link_created'
  | 'wallet_transfer.confirmed';

interface QueueWebhookEventInput {
  eventType: FondosEGWebhookEvent;
  payload: Record<string, unknown>;
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
  const { data: subscriptions, error } = await adminClient
    .from('webhook_subscriptions')
    .select('id')
    .eq('status', 'active')
    .contains('event_types', [input.eventType]);

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

export async function emitWebhookEvent(
  input: QueueWebhookEventInput,
  processLimit: number = 20
): Promise<{
  queued: number;
  delivery: {
    processed: number;
    sent: number;
    failed: number;
    retried: number;
  };
}> {
  const queued = await queueWebhookEvent(input);

  if (!queued) {
    return {
      queued: 0,
      delivery: { processed: 0, sent: 0, failed: 0, retried: 0 },
    };
  }

  const delivery = await processWebhookDeliveries(Math.max(processLimit, queued));
  return { queued, delivery };
}

export async function processWebhookDeliveries(limit: number = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
  retried: number;
}> {
  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await adminClient
    .from('webhook_deliveries')
    .select(`
      id,
      subscription_id,
      event_id,
      event_type,
      request_body,
      attempt_count,
      max_attempts,
      subscription:webhook_subscriptions(
        id,
        target_url,
        status,
        signing_secret_encrypted
      )
    `)
    .in('status', ['pending', 'retrying'])
    .lte('next_attempt_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  if (!jobs?.length) {
    return { processed: 0, sent: 0, failed: 0, retried: 0 };
  }

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const job of jobs) {
    const subscription = Array.isArray(job.subscription) ? job.subscription[0] : job.subscription;

    if (!subscription || subscription.status !== 'active') {
      await adminClient
        .from('webhook_deliveries')
        .update({
          status: 'failed',
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
      });

      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await adminClient
          .from('webhook_deliveries')
          .update({
            status: 'sent',
            attempt_count: Number(job.attempt_count || 0) + 1,
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
      const attemptCount = Number(job.attempt_count || 0) + 1;
      const maxAttempts = Number(job.max_attempts || 5);
      const message = error instanceof Error ? error.message : 'Webhook delivery failed';
      const responseStatus = error instanceof WebhookDispatchError ? error.responseStatus : null;
      const responseBody = error instanceof WebhookDispatchError ? error.responseBody : null;

      if (attemptCount >= maxAttempts) {
        await adminClient
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            attempt_count: attemptCount,
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
            attempt_count: attemptCount,
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
