import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildCheckoutUrl,
  isSafeReturnUrl,
  parseCreatePaymentRequest,
  resolvePaymentRequestStatus,
  toPaymentRequestWebhookPayload,
  toPublicPaymentRequest,
  type PaymentRequestRow,
} from '../../lib/server/payment-requests-contract.ts';
import { isDefinitiveDatabaseRejection } from '../../lib/server/db-errors.ts';
import { SUBSCRIBABLE_WEBHOOK_EVENTS } from '../../lib/server/webhook-events.ts';

const root = new URL('../../', import.meta.url);
const load = (path: string) => readFile(new URL(path, root), 'utf8');

// Cuerpo real que envía `rental-payment-initiate` de CasasEG.
const casasEgBody = {
  orderId: '40a8d923-2d90-45e6-b0d1-48c3156eb4f3',
  paymentReference: 'CEG-RENT-20261014212004-93F166F4',
  amount: 95000,
  currency: 'XAF',
  phoneNumber: null,
  customer: { id: '9b8e7d38-8de1-4dab-a75e-115e4aa4cc9f', email: 'inquilino@example.com' },
  metadata: { contractId: 'c-1', propertyId: 'p-1', ownerId: 'o-1', tenantId: 't-1' },
};

const row: PaymentRequestRow = {
  id: '11111111-1111-4111-8111-111111111111',
  external_reference: casasEgBody.orderId,
  payment_reference: casasEgBody.paymentReference,
  amount: '95000.00',
  currency: 'XAF',
  description: 'Alquiler octubre',
  status: 'pending',
  expires_at: '2026-10-16T10:00:00.000Z',
  paid_at: null,
  cancelled_at: null,
  wallet_transfer_id: null,
  metadata: { propertyId: 'p-1' },
  created_at: '2026-10-15T10:00:00.000Z',
};

test('acepta el cuerpo que envía CasasEG y lo normaliza', () => {
  const result = parseCreatePaymentRequest(casasEgBody);

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.externalReference, casasEgBody.orderId);
  assert.equal(result.data.paymentReference, casasEgBody.paymentReference);
  assert.equal(result.data.amount, 95000);
  assert.equal(result.data.currency, 'XAF');
  assert.equal(result.data.payerPhone, null);
  assert.deepEqual(result.data.metadata, casasEgBody.metadata);
  assert.equal(result.data.expiresInMinutes, 24 * 60);
});

test('acepta también los nombres snake_case', () => {
  const result = parseCreatePaymentRequest({
    external_reference: 'ORD-1',
    amount: '1500',
    currency: 'xaf',
    payer_phone: '+240222000111',
    return_url: 'https://casaseg.com/pagos',
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.externalReference, 'ORD-1');
  assert.equal(result.data.amount, 1500);
  assert.equal(result.data.currency, 'XAF');
  assert.equal(result.data.payerPhone, '+240222000111');
  assert.equal(result.data.returnUrl, 'https://casaseg.com/pagos');
});

test('rechaza solicitudes sin referencia, con importe inválido o returnUrl inseguro', () => {
  assert.equal(parseCreatePaymentRequest({ amount: 100 }).success, false);
  assert.equal(parseCreatePaymentRequest({ orderId: 'A', amount: 0 }).success, false);
  assert.equal(parseCreatePaymentRequest({ orderId: 'A', amount: 10_000_001 }).success, false);
  assert.equal(
    parseCreatePaymentRequest({ orderId: 'A', amount: 100, returnUrl: 'javascript:alert(1)' }).success,
    false
  );
  assert.equal(
    parseCreatePaymentRequest({ orderId: 'A', amount: 100, metadata: { blob: 'x'.repeat(5000) } }).success,
    false
  );
});

test('solo se permite volver a URLs https o localhost', () => {
  assert.equal(isSafeReturnUrl('https://casaseg.com/ok'), true);
  assert.equal(isSafeReturnUrl('http://localhost:5173/ok'), true);
  assert.equal(isSafeReturnUrl('http://casaseg.com/ok'), false);
  assert.equal(isSafeReturnUrl('exp://192.168.1.2:8081'), false);
  assert.equal(isSafeReturnUrl('no es una url'), false);
});

test('una solicitud pendiente vencida se presenta como expired', () => {
  const before = new Date('2026-10-16T09:59:59.000Z');
  const after = new Date('2026-10-16T10:00:00.000Z');

  assert.equal(resolvePaymentRequestStatus('pending', row.expires_at, before), 'pending');
  assert.equal(resolvePaymentRequestStatus('pending', row.expires_at, after), 'expired');
  assert.equal(resolvePaymentRequestStatus('paid', row.expires_at, after), 'paid');
});

test('la respuesta pública expone los campos que lee el parser de CasasEG', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  const output = toPublicPaymentRequest(row, 'https://fondoseg.com/', now);

  assert.equal(output.checkout_url, `https://fondoseg.com/pay/${row.id}`);
  assert.equal(output.provider_reference, row.id);
  assert.equal(output.status, 'pending');
  assert.equal(output.amount, 95000);
  assert.equal(buildCheckoutUrl('https://fondoseg.com', 'a b'), 'https://fondoseg.com/pay/a%20b');
});

test('el webhook lleva la referencia del integrador para conciliar', () => {
  const payload = toPaymentRequestWebhookPayload(
    { ...row, status: 'paid', paid_at: '2026-10-15T12:00:00.000Z', wallet_transfer_id: 'wt-1' },
    new Date('2026-10-15T12:00:01.000Z')
  );

  assert.equal(payload.reference, casasEgBody.orderId);
  assert.equal(payload.status, 'paid');
  assert.equal(payload.amount, 95000);
  assert.equal(payload.wallet_transfer_id, 'wt-1');
});

test('solo los rechazos definitivos de Postgres liberan la idempotencia', () => {
  assert.equal(isDefinitiveDatabaseRejection({ code: 'P0001', message: 'Saldo insuficiente' }), true);
  assert.equal(isDefinitiveDatabaseRejection({ code: '23505' }), true);
  assert.equal(isDefinitiveDatabaseRejection({ code: '22P02' }), true);
  assert.equal(isDefinitiveDatabaseRejection({ code: '' }), false);
  assert.equal(isDefinitiveDatabaseRejection({ code: '57014' }), false);
  assert.equal(isDefinitiveDatabaseRejection(new Error('fetch failed')), false);
  assert.equal(isDefinitiveDatabaseRejection(null), false);
});

test('los eventos de solicitudes de cobro son suscribibles', () => {
  assert.ok(SUBSCRIBABLE_WEBHOOK_EVENTS.includes('payment_request.paid'));
  assert.ok(SUBSCRIBABLE_WEBHOOK_EVENTS.includes('payment_request.cancelled'));
  assert.ok(SUBSCRIBABLE_WEBHOOK_EVENTS.includes('payment_request.payment_failed'));
});

test('un intento sin saldo avisa al comercio y deja la solicitud pendiente', async () => {
  const route = await load('app/api/payment-requests/[id]/route.ts');
  const service = await load('lib/server/payment-requests.ts');

  assert.match(service, /\/insufficient balance\/i\.test\(message\) \? 'insufficient_funds' : null/);
  assert.match(
    route,
    /emitPaymentRequestEvent\('payment_request\.payment_failed', paymentRequest, \{\s+failure_reason: failureReason,\s+\}\)/
  );
  // El aviso no cancela: el cliente puede recargar y reintentar el mismo cobro.
  const catchBlock = route.slice(route.indexOf('catch (payError)'), route.indexOf("emitPaymentRequestEvent('payment_request.paid'"));
  assert.doesNotMatch(catchBlock, /cancelPendingPaymentRequest/);
});

test('el pago de una solicitud es atómico y de un solo uso', async () => {
  const sql = await load('supabase/migrations/20261015_payment_requests.sql');

  assert.match(sql, /FROM public\.payment_requests\s+WHERE id = p_request_id\s+FOR UPDATE/);
  assert.match(sql, /IF v_request\.status <> 'pending' THEN/);
  assert.match(sql, /public\.create_wallet_transfer_settled_operation\(/);
  assert.match(sql, /UNIQUE \(merchant_user_id, external_reference\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.pay_payment_request/);
  assert.match(sql, /AND response_status IS NULL/);
});

test('el pago exige divisa del comercio y, si se indicó, el teléfono del pagador', async () => {
  const sql = await load('supabase/migrations/20261015_payment_requests.sql');

  assert.match(sql, /WHERE client_id = v_merchant\.id;\s+IF v_merchant_currency IS NOT NULL AND v_merchant_currency <> v_request\.currency/);
  assert.match(sql, /RAISE EXCEPTION 'Payer does not match payment request'/);
});

test('una key de test no lee ni cancela solicitudes reales', async () => {
  const list = await load('app/api/external/payment-requests/route.ts');
  const single = await load('app/api/external/payment-requests/[id]/route.ts');

  assert.match(list, /if \(apiKey\.environment === 'test'\) \{\s+await logPublicApiRequest\(\{ context, apiKeyId: apiKey\.id, status: 200 \}\);\s+return publicApiSuccess\(context, \[\]/);
  assert.equal(single.match(/apiKey\.environment !== 'test'/g)?.length, 2);
});

test('una referencia cancelada o caducada no devuelve un checkout muerto', async () => {
  const service = await load('lib/server/payment-requests.ts');

  assert.match(service, /status === 'cancelled' \|\| status === 'expired'/);
  assert.match(service, /throw new PaymentRequestClosedError\(\)/);
});

test('los webhooks de solicitudes se entregan solo al comercio dueño', async () => {
  const outbox = await load('lib/server/webhook-outbox.ts');

  assert.match(outbox, /ownerUserId/);
  assert.match(outbox, /\.eq\('user_id', input\.ownerUserId\)/);
});

test('la API acepta Authorization: Bearer como alternativa a x-api-key', async () => {
  const auth = await load('lib/api-auth.ts');

  assert.match(auth, /request\.headers\.get\('x-api-key'\)/);
  assert.match(auth, /Bearer/);
});
