import { z } from 'zod';

/**
 * Contrato público de las solicitudes de cobro.
 *
 * Sin imports con alias `@/`: lo cargan tanto las rutas como los tests de
 * `node --test`. Acepta los nombres en camelCase que envía CasasEG
 * (`orderId`, `paymentReference`, `phoneNumber`, `returnUrl`) y sus
 * equivalentes snake_case, para que cualquier integrador use su convención.
 */

export const PAYMENT_REQUEST_DEFAULT_EXPIRY_MINUTES = 24 * 60;
export const PAYMENT_REQUEST_MAX_EXPIRY_MINUTES = 7 * 24 * 60;
export const PAYMENT_REQUEST_MAX_AMOUNT = 10_000_000;
const MAX_METADATA_BYTES = 4 * 1024;

export type PaymentRequestStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export interface NormalizedPaymentRequestInput {
  externalReference: string;
  paymentReference: string | null;
  amount: number;
  currency: string;
  payerPhone: string | null;
  description: string | null;
  returnUrl: string | null;
  metadata: Record<string, unknown>;
  expiresInMinutes: number;
}

// `nullish`: los integradores suelen serializar campos vacíos como null.
const optionalText = (max: number) => z.string().trim().max(max).nullish();

const rawCreatePaymentRequestSchema = z.object({
  orderId: optionalText(100),
  external_reference: optionalText(100),
  reference: optionalText(100),
  paymentReference: optionalText(100),
  payment_reference: optionalText(100),
  amount: z.coerce.number().positive('amount debe ser mayor a 0').max(PAYMENT_REQUEST_MAX_AMOUNT),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'currency debe ser ISO 4217').default('XAF'),
  phoneNumber: optionalText(32),
  payer_phone: optionalText(32),
  description: optionalText(300),
  returnUrl: optionalText(500),
  return_url: optionalText(500),
  metadata: z.record(z.string(), z.unknown()).optional(),
  expires_in_minutes: z.coerce.number().int().min(5).max(PAYMENT_REQUEST_MAX_EXPIRY_MINUTES).optional(),
});

function firstText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

export function isSafeReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export type ParseResult =
  | { success: true; data: NormalizedPaymentRequestInput }
  | { success: false; details: Record<string, string[]> };

export function parseCreatePaymentRequest(input: unknown): ParseResult {
  const parsed = rawCreatePaymentRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, details: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const raw = parsed.data;
  const externalReference = firstText(raw.orderId, raw.external_reference, raw.reference);
  if (!externalReference) {
    return { success: false, details: { orderId: ['orderId (o external_reference) es requerido'] } };
  }

  const returnUrl = firstText(raw.returnUrl, raw.return_url);
  if (returnUrl && !isSafeReturnUrl(returnUrl)) {
    return { success: false, details: { returnUrl: ['returnUrl debe ser una URL https'] } };
  }

  const metadata = raw.metadata ?? {};
  if (new TextEncoder().encode(JSON.stringify(metadata)).length > MAX_METADATA_BYTES) {
    return { success: false, details: { metadata: ['metadata no puede superar 4 KB'] } };
  }

  return {
    success: true,
    data: {
      externalReference,
      paymentReference: firstText(raw.paymentReference, raw.payment_reference),
      amount: raw.amount,
      currency: raw.currency,
      payerPhone: firstText(raw.phoneNumber, raw.payer_phone),
      description: firstText(raw.description),
      returnUrl,
      metadata,
      expiresInMinutes: raw.expires_in_minutes ?? PAYMENT_REQUEST_DEFAULT_EXPIRY_MINUTES,
    },
  };
}

/** Una solicitud `pending` vencida se presenta como `expired` aunque nadie la haya barrido. */
export function resolvePaymentRequestStatus(
  status: string,
  expiresAt: string,
  now: Date = new Date()
): PaymentRequestStatus {
  if (status === 'pending' && new Date(expiresAt).getTime() <= now.getTime()) {
    return 'expired';
  }
  if (status === 'paid' || status === 'cancelled' || status === 'expired') return status;
  return 'pending';
}

/**
 * URL a la que vuelve el cliente tras pagar, rechazar o ver caducada la
 * solicitud. Añade `payment` (resultado) y `order` (la referencia del
 * integrador) para que su app sepa qué orden confirmar. Son solo una pista:
 * el integrador debe verificar el estado con la API, nunca fiarse de la URL.
 */
export function buildCheckoutReturnUrl(
  returnUrl: string,
  status: Exclude<PaymentRequestStatus, 'pending'>,
  externalReference: string
): string | null {
  if (!isSafeReturnUrl(returnUrl)) return null;
  const url = new URL(returnUrl);
  url.searchParams.set('payment', status);
  url.searchParams.set('order', externalReference);
  return url.toString();
}

export function buildCheckoutUrl(baseUrl: string, requestId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/pay/${encodeURIComponent(requestId)}`;
}

export interface PaymentRequestRow {
  id: string;
  external_reference: string;
  payment_reference: string | null;
  amount: number | string;
  currency: string;
  description: string | null;
  status: string;
  expires_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  wallet_transfer_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Forma pública. `provider_reference` y `checkout_url` son los nombres que
 * lee el parser genérico de CasasEG (`rental-payment-initiate`).
 */
export function toPublicPaymentRequest(row: PaymentRequestRow, baseUrl: string, now: Date = new Date()) {
  return {
    id: row.id,
    provider_reference: row.id,
    reference: row.external_reference,
    payment_reference: row.payment_reference,
    amount: Number(row.amount),
    currency: row.currency,
    description: row.description,
    status: resolvePaymentRequestStatus(row.status, row.expires_at, now),
    checkout_url: buildCheckoutUrl(baseUrl, row.id),
    wallet_transfer_id: row.wallet_transfer_id,
    metadata: row.metadata ?? {},
    expires_at: row.expires_at,
    paid_at: row.paid_at,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
  };
}

/** Datos del evento `payment_request.*` que reciben los webhooks del comercio. */
export function toPaymentRequestWebhookPayload(row: PaymentRequestRow, now: Date = new Date()) {
  return {
    payment_request_id: row.id,
    provider_reference: row.id,
    reference: row.external_reference,
    payment_reference: row.payment_reference,
    amount: Number(row.amount),
    currency: row.currency,
    status: resolvePaymentRequestStatus(row.status, row.expires_at, now),
    wallet_transfer_id: row.wallet_transfer_id,
    metadata: row.metadata ?? {},
    paid_at: row.paid_at,
    cancelled_at: row.cancelled_at,
  };
}
