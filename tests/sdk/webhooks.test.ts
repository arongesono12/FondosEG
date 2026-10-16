import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseFondosEGWebhookBody,
  signFondosEGWebhookPayload,
  verifyFondosEGWebhookSignature,
} from '../../sdk/typescript/fondoseg-sdk/src/webhooks.ts';
import type {
  FondosEGWebhookEnvelope,
  FondosEGWebhookEvent,
} from '../../sdk/typescript/fondoseg-sdk/src/types.ts';

const signingSecret = 'whsec_test_secret';
const now = new Date('2026-10-15T12:00:00.000Z');
const timestamp = String(Math.floor(now.getTime() / 1000));
const rawBody = JSON.stringify({
  id: 'evt-1',
  event: 'payment_request.paid',
  created_at: now.toISOString(),
  data: {
    payment_request_id: 'pr-1',
    provider_reference: 'pr-1',
    reference: 'ORD-1',
    payment_reference: null,
    amount: 95000,
    currency: 'XAF',
    status: 'paid',
    wallet_transfer_id: 'wt-1',
    metadata: {},
    paid_at: now.toISOString(),
    cancelled_at: null,
  },
});
const validSignature = `v1=${signFondosEGWebhookPayload({ signingSecret, timestamp, rawBody })}`;

const verify = (signature: string, overrides: { timestamp?: string; rawBody?: string } = {}) =>
  verifyFondosEGWebhookSignature({
    signingSecret,
    timestamp: overrides.timestamp ?? timestamp,
    rawBody: overrides.rawBody ?? rawBody,
    signature,
    now,
  });

test('acepta la firma que genera FondosEG, con o sin prefijo v1=', () => {
  assert.equal(verify(validSignature), true);
  assert.equal(verify(validSignature.slice(3)), true);
});

test('rechaza cuerpo alterado, timestamp fuera de tolerancia y firma vacía', () => {
  assert.equal(verify(validSignature, { rawBody: rawBody.replace('95000', '1') }), false);
  assert.equal(verify(validSignature, { timestamp: String(Number(timestamp) - 301) }), false);
  assert.equal(verify(validSignature, { timestamp: 'no-es-un-numero' }), false);
  assert.equal(verify(''), false);
});

test('una firma mal formada devuelve false en lugar de lanzar', () => {
  // Misma longitud que una firma real (64) pero con caracteres no hexadecimales:
  // Buffer.from(..., 'hex') la truncaba y timingSafeEqual lanzaba RangeError.
  const notHex = `v1=${'z'.repeat(64)}`;
  const mixed = `v1=${'a'.repeat(62)}zz`;

  assert.doesNotThrow(() => verify(notHex));
  assert.equal(verify(notHex), false);
  assert.equal(verify(mixed), false);
  assert.equal(verify(`v1=${'a'.repeat(63)}`), false);
});

test('los tipos incluyen los eventos de solicitudes de cobro', () => {
  const events: FondosEGWebhookEvent[] = ['payment_request.paid', 'payment_request.cancelled'];
  const envelope = parseFondosEGWebhookBody<'payment_request.paid'>(rawBody);
  const typed: FondosEGWebhookEnvelope<'payment_request.paid'> = envelope;

  assert.deepEqual(events, ['payment_request.paid', 'payment_request.cancelled']);
  assert.equal(typed.data.reference, 'ORD-1');
  assert.equal(typed.data.amount, 95000);
  assert.equal(typed.data.status, 'paid');
});
