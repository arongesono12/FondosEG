import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { authorizePaymentsKey } from '@/lib/server/payments-key-auth';
import {
  parseCreatePaymentRequest,
  toPublicPaymentRequest,
} from '@/lib/server/payment-requests-contract';
import {
  createOrReusePaymentRequest,
  getPublicAppBaseUrl,
  PAYMENT_REQUEST_SELECT,
  PaymentRequestClosedError,
  PaymentRequestConflictError,
  PaymentRequestRejectedError,
  type StoredPaymentRequest,
} from '@/lib/server/payment-requests';
import {
  createPublicApiContext,
  logPublicApiRequest,
  publicApiError,
  publicApiSuccess,
  readJsonBody,
} from '@/lib/server/public-api';

/**
 * Solicitudes de cobro: el integrador pide un pago a un cliente de FondosEG y
 * recibe un `checkout_url` donde el cliente lo aprueba con su sesión. El
 * importe se abona en la billetera del dueño de la API key.
 */

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['pending', 'paid', 'cancelled', 'expired']).optional(),
  reference: z.string().trim().min(1).max(100).optional(),
}).strict();

function buildSandboxRequest(reference: string, amount: number, currency: string, baseUrl: string) {
  const now = new Date();
  return toPublicPaymentRequest(
    {
      id: '00000000-0000-4000-8000-000000000501',
      external_reference: reference,
      payment_reference: null,
      amount,
      currency,
      description: 'Solicitud de cobro de prueba',
      status: 'pending',
      expires_at: new Date(now.getTime() + 24 * 60 * 60_000).toISOString(),
      paid_at: null,
      cancelled_at: null,
      wallet_transfer_id: null,
      metadata: { sandbox: true },
      created_at: now.toISOString(),
    },
    baseUrl,
    now
  );
}

export async function POST(request: NextRequest) {
  const context = createPublicApiContext(request);
  const authorized = await authorizePaymentsKey(request, context);
  if ('response' in authorized) return authorized.response;

  const { apiKey, auth } = authorized;
  const responseInit = { environment: apiKey.environment, rateLimit: auth.rateLimit };

  try {
    const body = await readJsonBody(request);
    const parsed = body.success ? parseCreatePaymentRequest(body.data) : null;
    if (!body.success || !parsed?.success) {
      const details = !body.success ? body.details : parsed && !parsed.success ? parsed.details : undefined;
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 400, errorCode: 'validation_error' });
      return publicApiError(context, 'validation_error', 'Payload invalido', 400, details, responseInit);
    }

    const baseUrl = getPublicAppBaseUrl(request.url);
    const input = parsed.data;

    if (apiKey.environment === 'test') {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 201 });
      return publicApiSuccess(
        context,
        buildSandboxRequest(input.externalReference, input.amount, input.currency, baseUrl),
        { ...responseInit, status: 201 }
      );
    }

    const { request: paymentRequest, created } = await createOrReusePaymentRequest({
      apiKeyId: apiKey.id,
      merchantUserId: apiKey.user_id,
      input,
    });

    const status = created ? 201 : 200;
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status });
    return publicApiSuccess(context, toPublicPaymentRequest(paymentRequest, baseUrl), { ...responseInit, status });
  } catch (error) {
    if (error instanceof PaymentRequestConflictError || error instanceof PaymentRequestClosedError) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 409, errorCode: 'idempotency_conflict' });
      return publicApiError(context, 'idempotency_conflict', error.message, 409, undefined, responseInit);
    }
    if (error instanceof PaymentRequestRejectedError) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 400, errorCode: 'business_rule_failed' });
      return publicApiError(context, 'business_rule_failed', error.message, 400, undefined, responseInit);
    }
    console.error('API Payment Requests POST Error:', error);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, responseInit);
  }
}

export async function GET(request: NextRequest) {
  const context = createPublicApiContext(request);
  const authorized = await authorizePaymentsKey(request, context);
  if ('response' in authorized) return authorized.response;

  const { apiKey, auth } = authorized;
  const responseInit = { environment: apiKey.environment, rateLimit: auth.rateLimit };

  try {
    const parsedQuery = listQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsedQuery.success) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 400, errorCode: 'validation_error' });
      return publicApiError(context, 'validation_error', 'Parametros de consulta invalidos', 400,
        parsedQuery.error.flatten().fieldErrors, responseInit);
    }

    const { limit, offset, status, reference } = parsedQuery.data;
    const baseUrl = getPublicAppBaseUrl(request.url);

    // Una key de test nunca lee datos reales.
    if (apiKey.environment === 'test') {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 200 });
      return publicApiSuccess(context, [], {
        ...responseInit,
        pagination: { limit, offset, has_more: false, next_offset: null },
      });
    }

    let query = createAdminClient()
      .from('payment_requests')
      .select(PAYMENT_REQUEST_SELECT)
      .eq('merchant_user_id', apiKey.user_id)
      .order('created_at', { ascending: false });

    if (status === 'expired') {
      query = query.or(`status.eq.expired,and(status.eq.pending,expires_at.lte.${new Date().toISOString()})`);
    } else if (status === 'pending') {
      query = query.eq('status', 'pending').gt('expires_at', new Date().toISOString());
    } else if (status) {
      query = query.eq('status', status);
    }
    if (reference) query = query.eq('external_reference', reference);

    const { data, error } = await query.range(offset, offset + limit);
    if (error) throw new Error(error.message);

    const rows = (data || []) as StoredPaymentRequest[];
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((row) => toPublicPaymentRequest(row, baseUrl));

    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 200 });
    return publicApiSuccess(context, items, {
      ...responseInit,
      pagination: { limit, offset, has_more: hasMore, next_offset: hasMore ? offset + limit : null },
    });
  } catch (error) {
    console.error('API Payment Requests GET Error:', error);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, responseInit);
  }
}
