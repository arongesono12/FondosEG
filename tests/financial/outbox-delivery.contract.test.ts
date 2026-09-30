import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function load(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

test('la confirmación de un envío no espera a Twilio ni a los webhooks', async () => {
  const route = await load('app/api/transfers/route.ts');
  const post = route.slice(route.indexOf('export async function POST'));

  // Sólo se registran los trabajos; la entrega va después de responder.
  assert.doesNotMatch(post, /processNotificationOutbox\(/);
  assert.doesNotMatch(post, /processWebhookDeliveries\(/);
  assert.doesNotMatch(post, /emitWebhookEvent\(/);
  assert.match(post, /queueTransferNotifications\(/);
  assert.match(post, /queueWebhookEvent\(/);
  assert.ok(
    post.indexOf('scheduleOutboxProcessing()') < post.indexOf('return NextResponse.json({ success: true'),
    'la entrega se programa, no se espera'
  );

  const worker = await load('lib/server/outbox-worker.ts');
  assert.match(worker, /import \{ after \} from 'next\/server'/);
});

test('la evidencia de consentimiento del envío de gestor se escribe en la misma transacción', async () => {
  const [route, migration] = await Promise.all([
    load('app/api/transfers/route.ts'),
    load('supabase/migrations/20260926_outbox_worker_and_atomic_consent.sql'),
  ]);

  assert.doesNotMatch(route, /recordPaymentConsent\(/, 'un fallo posterior devolvía error con el dinero ya movido');
  assert.match(route, /createAgentTransferWithConsent\(/);

  const fn = migration.slice(migration.indexOf('FUNCTION public.create_agent_transfer_with_consent_operation'));
  assert.ok(
    fn.indexOf('public.create_agent_transfer_operation(') < fn.indexOf('INSERT INTO public.compliance_events'),
    'el envío y la evidencia viven en la misma función'
  );
});

test('los trabajos de SMS y webhooks se reclaman de forma exclusiva y con plazo', async () => {
  const [sms, webhooks, migration] = await Promise.all([
    load('lib/server/notification-outbox.ts'),
    load('lib/server/webhook-outbox.ts'),
    load('supabase/migrations/20260926_outbox_worker_and_atomic_consent.sql'),
  ]);

  // Leer 'pending' con un SELECT y actualizar después dejaba que dos workers
  // enviasen el mismo mensaje.
  assert.match(sms, /rpc\('claim_notification_outbox'/);
  assert.match(webhooks, /rpc\('claim_webhook_deliveries'/);
  for (const fn of ['claim_notification_outbox', 'claim_webhook_deliveries']) {
    const start = migration.indexOf(`FUNCTION public.${fn}`);
    const body = migration.slice(start, migration.indexOf('$$;', start));
    assert.match(body, /FOR UPDATE SKIP LOCKED/, `${fn} debe reclamar con SKIP LOCKED`);
  }

  // Un proveedor colgado no puede bloquear el lote indefinidamente.
  assert.match(sms, /timeout: TWILIO_TIMEOUT_MS/);
  assert.match(webhooks, /signal: AbortSignal\.timeout\(WEBHOOK_TIMEOUT_MS\)/);
});
