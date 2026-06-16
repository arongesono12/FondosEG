import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Outbound client + inbound signature verification for the external payments
 * app ("la otra app de pagos"). FondosEG calls the provider to create rent
 * charges, and the provider calls FondosEG back via webhooks. Secrets are read
 * from the environment (set them in the Supabase / hosting dashboard).
 *
 * Expected provider contract (designed by FondosEG):
 *   POST {BASE_URL}/charges
 *     headers: x-api-key, x-api-secret, x-fondoseg-timestamp, x-fondoseg-signature
 *     body:    { reference, amount, currency, description, customer, metadata, callback_url }
 *     200/201: { id, status, checkout_url?, reference? }
 *
 *   Webhook -> POST {our callback}
 *     headers: x-payments-timestamp, x-payments-signature (v1=<hmac>)
 *     body:    { id, type, data: { payment_id|reference, status, ... } }
 */

export interface PaymentsProviderConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  providerName: string;
}

export interface CreateChargeInput {
  /** Internal rental_payment id used as idempotent reference. */
  reference: string;
  amount: number;
  currency: string;
  description: string;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
  };
  /** Where the provider should send status webhooks. */
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateChargeResult {
  providerPaymentId: string | null;
  status: RentalPaymentStatus;
  checkoutUrl: string | null;
  reference: string | null;
  raw: unknown;
}

export type RentalPaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export class PaymentsProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PaymentsProviderError';
    this.status = status;
  }
}

export function isPaymentsProviderConfigured(): boolean {
  return Boolean(
    process.env.PAYMENTS_PROVIDER_BASE_URL &&
      process.env.PAYMENTS_PROVIDER_API_KEY &&
      process.env.PAYMENTS_PROVIDER_API_SECRET
  );
}

export function getProviderName(): string {
  return process.env.PAYMENTS_PROVIDER_NAME?.trim() || 'payments-app';
}

function readConfig(): PaymentsProviderConfig {
  const baseUrl = process.env.PAYMENTS_PROVIDER_BASE_URL?.trim();
  const apiKey = process.env.PAYMENTS_PROVIDER_API_KEY?.trim();
  const apiSecret = process.env.PAYMENTS_PROVIDER_API_SECRET?.trim();
  const webhookSecret = process.env.PAYMENTS_PROVIDER_WEBHOOK_SECRET?.trim() || '';

  if (!baseUrl || !apiKey || !apiSecret) {
    throw new PaymentsProviderError('La app de pagos no está configurada (faltan secretos)');
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    apiSecret,
    webhookSecret,
    providerName: getProviderName(),
  };
}

/** Maps a provider status string to FondosEG's normalized status. */
export function normalizeProviderStatus(value: unknown): RentalPaymentStatus {
  const status = String(value ?? '').toLowerCase();
  switch (status) {
    case 'paid':
    case 'succeeded':
    case 'success':
    case 'completed':
      return 'paid';
    case 'failed':
    case 'declined':
    case 'error':
      return 'failed';
    case 'refunded':
    case 'reversed':
      return 'refunded';
    case 'cancelled':
    case 'canceled':
    case 'voided':
      return 'cancelled';
    case 'processing':
    case 'pending_confirmation':
    case 'authorized':
      return 'processing';
    default:
      return 'pending';
  }
}

function signRequest(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function createProviderCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
  const config = readConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    reference: input.reference,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    customer: {
      name: input.customer.name,
      phone: input.customer.phone,
      email: input.customer.email ?? undefined,
    },
    callback_url: input.callbackUrl,
    metadata: input.metadata ?? {},
  });

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'x-api-secret': config.apiSecret,
        'x-fondoseg-timestamp': timestamp,
        'x-fondoseg-signature': `v1=${signRequest(config.apiSecret, timestamp, body)}`,
      },
      body,
    });
  } catch (error) {
    throw new PaymentsProviderError(
      `No se pudo contactar la app de pagos: ${error instanceof Error ? error.message : 'error de red'}`
    );
  }

  const text = await response.text().catch(() => '');
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    const message =
      (typeof parsed.message === 'string' && parsed.message) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      `La app de pagos respondió ${response.status}`;
    throw new PaymentsProviderError(message, response.status);
  }

  const data = (parsed.data as Record<string, unknown>) ?? parsed;

  return {
    providerPaymentId:
      (data.id as string) ?? (data.payment_id as string) ?? (data.charge_id as string) ?? null,
    status: normalizeProviderStatus(data.status),
    checkoutUrl: (data.checkout_url as string) ?? (data.payment_url as string) ?? null,
    reference: (data.reference as string) ?? input.reference,
    raw: parsed,
  };
}

/**
 * Verifies an inbound provider webhook signature using the shared webhook
 * secret. Accepts `v1=<hex>` or a bare hex digest. Returns false (never throws)
 * so callers can log + 401 cleanly.
 */
export function verifyProviderWebhookSignature(
  timestamp: string | null,
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.PAYMENTS_PROVIDER_WEBHOOK_SECRET?.trim();
  if (!secret || !timestamp || !signatureHeader) {
    return false;
  }

  const provided = signatureHeader.startsWith('v1=') ? signatureHeader.slice(3) : signatureHeader;
  const expected = signRequest(secret, timestamp, rawBody);

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
