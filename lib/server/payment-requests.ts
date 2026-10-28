import 'server-only';
import { PAYMENT_REGULATION } from '@/lib/compliance';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import {
  resolvePaymentRequestStatus,
  resolvePublicAppBaseUrl,
  toPaymentRequestWebhookPayload,
  type NormalizedPaymentRequestInput,
  type PaymentRequestRow,
} from '@/lib/server/payment-requests-contract';

/**
 * Acceso a datos y efectos de las solicitudes de cobro. Las reglas de
 * validación viven en `payment-requests-contract.ts`; el movimiento de dinero,
 * en la RPC `pay_payment_request`.
 */

export const PAYMENT_REQUEST_SELECT =
  'id, api_key_id, merchant_user_id, merchant_name, external_reference, payment_reference, amount, currency, description, payer_phone, payer_user_id, status, return_url, metadata, wallet_transfer_id, expires_at, paid_at, cancelled_at, created_at';

export interface StoredPaymentRequest extends PaymentRequestRow {
  api_key_id: string;
  merchant_user_id: string;
  merchant_name: string;
  payer_phone: string | null;
  payer_user_id: string | null;
  return_url: string | null;
}

export class PaymentRequestConflictError extends Error {
  constructor() {
    super('Ya existe una solicitud con esta referencia y un importe o divisa distintos');
    this.name = 'PaymentRequestConflictError';
  }
}

export function getPublicAppBaseUrl(requestUrl: string): string {
  return resolvePublicAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL, requestUrl);
}

export async function findPaymentRequestById(id: string): Promise<StoredPaymentRequest | null> {
  const { data, error } = await createAdminClient()
    .from('payment_requests')
    .select(PAYMENT_REQUEST_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as StoredPaymentRequest | null) ?? null;
}

async function findByMerchantReference(merchantUserId: string, externalReference: string) {
  const { data, error } = await createAdminClient()
    .from('payment_requests')
    .select(PAYMENT_REQUEST_SELECT)
    .eq('merchant_user_id', merchantUserId)
    .eq('external_reference', externalReference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as StoredPaymentRequest | null) ?? null;
}

/** Regla de negocio que impide crear la solicitud (400, no 500). */
export class PaymentRequestRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRequestRejectedError';
  }
}

export class PaymentRequestClosedError extends Error {
  constructor() {
    super('La solicitud con esta referencia fue cancelada o caducó; inicia el cobro con una referencia nueva');
    this.name = 'PaymentRequestClosedError';
  }
}

function assertSameCharge(existing: StoredPaymentRequest, input: NormalizedPaymentRequestInput) {
  if (Number(existing.amount) !== input.amount || existing.currency !== input.currency) {
    throw new PaymentRequestConflictError();
  }
  // Devolver un checkout_url muerto dejaría al pedido del integrador bloqueado.
  const status = resolvePaymentRequestStatus(existing.status, existing.expires_at);
  if (status === 'cancelled' || status === 'expired') {
    throw new PaymentRequestClosedError();
  }
}

/** Mismo criterio que la RPC: solo los dígitos finales, para tolerar formatos. */
export function phonesMatch(expected: string | null, actual: string | null | undefined): boolean {
  if (!expected?.trim()) return true;
  const digits = (value: string) => value.replace(/\D/g, '').slice(-9);
  return Boolean(actual) && digits(expected) === digits(actual ?? '');
}

/**
 * Crea la solicitud o devuelve la existente para la misma referencia. La
 * referencia del integrador (su id de pedido) actúa como clave idempotente
 * natural: un reintento de red nunca genera dos cobros.
 */
export async function createOrReusePaymentRequest(params: {
  apiKeyId: string;
  merchantUserId: string;
  input: NormalizedPaymentRequestInput;
}): Promise<{ request: StoredPaymentRequest; created: boolean }> {
  const { apiKeyId, merchantUserId, input } = params;
  const existing = await findByMerchantReference(merchantUserId, input.externalReference);
  if (existing) {
    assertSameCharge(existing, input);
    return { request: existing, created: false };
  }

  const adminClient = createAdminClient();
  const { data: merchant, error: merchantError } = await adminClient
    .from('users')
    .select('id, name, role')
    .eq('id', merchantUserId)
    .maybeSingle();

  if (merchantError) throw new Error(merchantError.message);
  if (!merchant || merchant.role !== 'cliente') {
    throw new PaymentRequestRejectedError('La credencial debe pertenecer a una billetera de cliente para recibir cobros');
  }

  const { data: merchantBalance, error: balanceError } = await adminClient
    .from('client_balances')
    .select('currency')
    .eq('client_id', merchantUserId)
    .maybeSingle();

  if (balanceError) throw new Error(balanceError.message);
  if (merchantBalance?.currency && merchantBalance.currency !== input.currency) {
    throw new PaymentRequestRejectedError(
      `La billetera receptora opera en ${merchantBalance.currency}; no puede cobrar en ${input.currency}`
    );
  }

  const { data, error } = await adminClient
    .from('payment_requests')
    .insert({
      api_key_id: apiKeyId,
      merchant_user_id: merchantUserId,
      merchant_name: merchant.name || 'Comercio FondosEG',
      external_reference: input.externalReference,
      payment_reference: input.paymentReference,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      payer_phone: input.payerPhone,
      return_url: input.returnUrl,
      metadata: input.metadata,
      expires_at: new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString(),
    })
    .select(PAYMENT_REQUEST_SELECT)
    .single();

  if (error?.code === '23505') {
    // Carrera entre dos peticiones con la misma referencia: gana la primera.
    const winner = await findByMerchantReference(merchantUserId, input.externalReference);
    if (!winner) throw new Error(error.message);
    assertSameCharge(winner, input);
    return { request: winner, created: false };
  }
  if (error || !data) throw new Error(error?.message || 'No se pudo crear la solicitud de cobro');

  return { request: data as StoredPaymentRequest, created: true };
}

/** Solo se cancela lo que sigue pendiente; la condición va en el UPDATE. */
export async function cancelPendingPaymentRequest(
  id: string,
  filter: { merchantUserId?: string }
): Promise<StoredPaymentRequest | null> {
  let query = createAdminClient()
    .from('payment_requests')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (filter.merchantUserId) query = query.eq('merchant_user_id', filter.merchantUserId);

  const { data, error } = await query.select(PAYMENT_REQUEST_SELECT).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoredPaymentRequest | null) ?? null;
}

export async function payPaymentRequest(params: {
  requestId: string;
  payerId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<StoredPaymentRequest> {
  const { data, error } = await createAdminClient().rpc('pay_payment_request', {
    p_request_id: params.requestId,
    p_payer_id: params.payerId,
    p_regulation_code: PAYMENT_REGULATION.code,
    p_disclosure_version: PAYMENT_REGULATION.disclosureVersion,
    p_ip_address: params.ipAddress,
    p_user_agent: params.userAgent,
  });

  if (error) throw new Error(error.message);
  return (data as { request: StoredPaymentRequest }).request;
}

/** Notifica al comercio. Un fallo de entrega se reintenta desde el outbox, no rompe el pago. */
export async function emitPaymentRequestEvent(
  eventType: 'payment_request.paid' | 'payment_request.cancelled' | 'payment_request.payment_failed',
  request: StoredPaymentRequest,
  extra: Record<string, unknown> = {}
): Promise<void> {
  try {
    await emitWebhookEvent(
      {
        eventType,
        ownerUserId: request.merchant_user_id,
        payload: { ...toPaymentRequestWebhookPayload(request), ...extra },
      }
    );
  } catch (webhookError) {
    console.error(`No se pudo emitir ${eventType}:`, webhookError);
  }
}

const PAY_ERROR_MESSAGES: Array<[RegExp, string]> = [
  [/insufficient balance/i, 'Saldo insuficiente en tu billetera'],
  [/not pending/i, 'Esta solicitud ya no está pendiente'],
  [/has expired/i, 'Esta solicitud de cobro ha caducado'],
  [/same account/i, 'No puedes pagarte a ti mismo'],
  [/payer does not match/i, 'Esta solicitud de cobro está dirigida a otro cliente'],
  [/sender is not a valid client/i, 'Solo los clientes pueden pagar desde la billetera'],
  [/payer phone is required/i, 'Añade tu número de teléfono en tu perfil antes de pagar'],
  [/currency mismatch/i, 'Tu billetera opera en otra divisa'],
  [/receiver account is not active/i, 'La cuenta del comercio no está activa'],
  [/receiver is not a valid client/i, 'La cuenta del comercio no puede recibir pagos'],
];

/**
 * Fallos de pago que el comercio debe conocer. La solicitud sigue pendiente
 * (el cliente puede recargar y reintentar); el comercio decide si la anula.
 */
export function paymentFailureReason(error: unknown): 'insufficient_funds' | null {
  const message = error instanceof Error ? error.message : '';
  return /insufficient balance/i.test(message) ? 'insufficient_funds' : null;
}

export function translatePayError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const match = PAY_ERROR_MESSAGES.find(([pattern]) => pattern.test(message));
  return match?.[1] ?? 'No se pudo completar el pago. Inténtalo de nuevo.';
}
