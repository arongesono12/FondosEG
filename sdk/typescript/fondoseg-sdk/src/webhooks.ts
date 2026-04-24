import { createHmac, timingSafeEqual } from 'crypto';
import type {
  FondosEGWebhookEnvelope,
  FondosEGWebhookEvent,
  FondosEGWebhookHeaders,
} from './types';

function stripSignaturePrefix(signature: string): string {
  return signature.replace(/^v1=/, '');
}

export function signFondosEGWebhookPayload(input: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
}): string {
  return createHmac('sha256', input.signingSecret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest('hex');
}

export function verifyFondosEGWebhookSignature(input: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
  signature: string;
  toleranceSeconds?: number;
  now?: Date;
}): boolean {
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const now = input.now ?? new Date();
  const timestampSeconds = Number(input.timestamp);

  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Math.floor(now.getTime() / 1000) - timestampSeconds) > toleranceSeconds) {
    return false;
  }

  const expected = signFondosEGWebhookPayload({
    signingSecret: input.signingSecret,
    timestamp: input.timestamp,
    rawBody: input.rawBody,
  });
  const received = stripSignaturePrefix(input.signature);

  if (expected.length !== received.length) return false;

  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

export function parseFondosEGWebhookHeaders(headers: Headers | Record<string, string | string[] | undefined>): FondosEGWebhookHeaders {
  const get = (key: string) => {
    if (headers instanceof Headers) return headers.get(key) || '';
    const value = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] || '' : value || '';
  };

  return {
    id: get('X-FondosEG-Webhook-Id'),
    event: get('X-FondosEG-Webhook-Event') as FondosEGWebhookEvent,
    timestamp: get('X-FondosEG-Webhook-Timestamp'),
    signature: get('X-FondosEG-Webhook-Signature'),
  };
}

export function parseFondosEGWebhookBody<TEvent extends FondosEGWebhookEvent = FondosEGWebhookEvent>(
  rawBody: string
): FondosEGWebhookEnvelope<TEvent> {
  return JSON.parse(rawBody) as FondosEGWebhookEnvelope<TEvent>;
}
