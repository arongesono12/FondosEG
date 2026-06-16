import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { isAdminRole } from '@/lib/roles';
import { persistIdempotencyResponse, readIdempotencyState } from '@/lib/server/api-idempotency';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import {
  createRentalPaymentOperation,
  updateRentalPaymentStatusOperation,
} from '@/lib/server/property-operations';
import {
  createProviderCharge,
  getProviderName,
  isPaymentsProviderConfigured,
  PaymentsProviderError,
} from '@/lib/server/payments-provider';
import {
  createPublicApiContext,
  logPublicApiRequest,
  mapAuthErrorStatus,
  publicApiCachedResponse,
  publicApiError,
  publicApiSuccess,
  readJsonBody,
  toPublicBusinessErrorMessage,
} from '@/lib/server/public-api';

const paymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled']).optional(),
  rental_id: z.string().trim().uuid().optional(),
}).strict();

const createPaymentSchema = z.object({
  rental_id: z.string().trim().uuid('rental_id debe ser un UUID valido'),
  amount: z.coerce.number().positive('amount debe ser mayor a 0').max(10000000).optional(),
  currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/).optional(),
  period: z.string().trim().regex(/^\d{4}-\d{2}$/, 'period debe tener formato YYYY-MM').optional(),
  payment_method: z.string().trim().max(40).optional(),
  callback_url: z.string().trim().url().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

const PAYMENT_SELECT =
  'id, rental_id, property_id, owner_id, tenant_id, period, amount, currency, status, payment_method, provider, provider_payment_id, provider_reference, provider_checkout_url, failure_reason, paid_at, created_at';

export async function GET(request: NextRequest) {
  const context = createPublicApiContext(request);
  let apiKeyId: string | null = null;
  let apiEnvironment: 'test' | 'production' | undefined;

  try {
    const auth = await authenticateAPIKey(request);

    if (!auth.success) {
      const status = auth.status || 401;
      const code = auth.errorCode || mapAuthErrorStatus(status);
      await logPublicApiRequest({ context, status, errorCode: code });
      return publicApiError(context, code, auth.error || 'Credenciales invalidas', status, undefined, {
        rateLimit: auth.rateLimit,
      });
    }

    apiKeyId = auth.apiKey!.id;
    apiEnvironment = auth.apiKey!.environment;

    if (!await requirePermission(auth, 'payments')) {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: payments', 403, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const { user_id, role_access } = auth.apiKey!;
    const { searchParams } = new URL(request.url);
    const parsedQuery = paymentsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsedQuery.success) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(
        context,
        'validation_error',
        'Parametros de consulta invalidos',
        400,
        parsedQuery.error.flatten().fieldErrors,
        { environment: auth.apiKey!.environment, rateLimit: auth.rateLimit }
      );
    }

    const { limit, offset, status, rental_id } = parsedQuery.data;

    if (auth.apiKey!.environment === 'test') {
      await logPublicApiRequest({ context, apiKeyId, status: 200 });
      return publicApiSuccess(context, [buildSandboxPayment()], {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
        pagination: { limit, offset, has_more: false, next_offset: null },
      });
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from('rental_payments')
      .select(PAYMENT_SELECT)
      .order('created_at', { ascending: false });

    if (!isAdminRole(role_access)) {
      query = role_access === 'cliente'
        ? query.eq('tenant_id', user_id)
        : query.eq('owner_id', user_id);
    }

    if (status) query = query.eq('status', status);
    if (rental_id) query = query.eq('rental_id', rental_id);

    const { data } = await query.range(offset, offset + limit);
    const rows = data || [];
    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;

    await logPublicApiRequest({ context, apiKeyId, status: 200 });
    return publicApiSuccess(context, pageItems, {
      environment: auth.apiKey!.environment,
      rateLimit: auth.rateLimit,
      pagination: {
        limit,
        offset,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
      },
    });

  } catch (error) {
    console.error('API Rental Payments GET Error:', error);
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
      environment: apiEnvironment,
    });
  }
}

export async function POST(request: NextRequest) {
  const context = createPublicApiContext(request);
  let apiKeyId: string | null = null;
  let apiEnvironment: 'test' | 'production' | undefined;

  try {
    const auth = await authenticateAPIKey(request);

    if (!auth.success) {
      const status = auth.status || 401;
      const code = auth.errorCode || mapAuthErrorStatus(status);
      await logPublicApiRequest({ context, status, errorCode: code });
      return publicApiError(context, code, auth.error || 'Credenciales invalidas', status, undefined, {
        rateLimit: auth.rateLimit,
      });
    }

    apiKeyId = auth.apiKey!.id;
    apiEnvironment = auth.apiKey!.environment;

    if (!await requirePermission(auth, 'payments')) {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: payments', 403, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const { user_id, role_access } = auth.apiKey!;

    const jsonBody = await readJsonBody(request);
    if (!jsonBody.success) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(context, 'validation_error', 'Payload invalido', 400, jsonBody.details, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const parsedBody = createPaymentSchema.safeParse(jsonBody.data);
    if (!parsedBody.success) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(
        context,
        'validation_error',
        'Payload invalido',
        400,
        parsedBody.error.flatten().fieldErrors,
        { environment: auth.apiKey!.environment, rateLimit: auth.rateLimit }
      );
    }

    const idempotencyState = await readIdempotencyState(
      auth.apiKey!.id,
      request.headers.get('idempotency-key'),
      jsonBody.data
    );

    if (idempotencyState?.conflictMessage) {
      await logPublicApiRequest({ context, apiKeyId, status: 409, errorCode: 'idempotency_conflict' });
      return publicApiError(context, 'idempotency_conflict', idempotencyState.conflictMessage, 409, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    if (idempotencyState?.cachedResponse) {
      await logPublicApiRequest({ context, apiKeyId, status: idempotencyState.cachedResponse.status });
      return publicApiCachedResponse(
        context,
        idempotencyState.cachedResponse.body,
        idempotencyState.cachedResponse.status,
        { environment: auth.apiKey!.environment, rateLimit: auth.rateLimit }
      );
    }

    const { rental_id, amount, currency, period, payment_method, callback_url, metadata } = parsedBody.data;

    if (auth.apiKey!.environment === 'test') {
      const sandbox = buildSandboxPayment({ rental_id, amount, currency, period });
      const responseBody = { success: true, data: sandbox, request_id: context.requestId };
      await persistIdempotencyResponse(auth.apiKey!.id, idempotencyState, 201, responseBody);
      await logPublicApiRequest({ context, apiKeyId, status: 201 });
      return publicApiSuccess(context, sandbox, {
        status: 201,
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const adminClient = createAdminClient();

    // Scope check: the rental must belong to the credential (unless admin).
    const { data: rental } = await adminClient
      .from('rentals')
      .select('id, owner_id, tenant_id, tenant_name, tenant_phone, tenant_email, status')
      .eq('id', rental_id)
      .maybeSingle();

    if (!rental) {
      await logPublicApiRequest({ context, apiKeyId, status: 404, errorCode: 'not_found' });
      return publicApiError(context, 'not_found', 'El alquiler no existe', 404, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    if (!isAdminRole(role_access)) {
      const owns = role_access === 'cliente'
        ? rental.tenant_id === user_id
        : rental.owner_id === user_id;
      if (!owns) {
        await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
        return publicApiError(context, 'permission_denied', 'No tienes acceso a este alquiler', 403, undefined, {
          environment: auth.apiKey!.environment,
          rateLimit: auth.rateLimit,
        });
      }
    }

    const providerName = getProviderName();
    const { payment } = await createRentalPaymentOperation({
      rentalId: rental_id,
      actorUserId: user_id,
      period,
      amount: amount ?? 0,
      currency,
      paymentMethod: payment_method,
      provider: providerName,
      idempotencyKey: request.headers.get('idempotency-key'),
      metadata: metadata ?? null,
    });

    let finalPayment = payment;

    // Outbound: create the charge in the external payments app (if wired up).
    if (isPaymentsProviderConfigured()) {
      const callbackUrl = callback_url || `${new URL(request.url).origin}/api/webhooks/payments-provider`;
      try {
        const charge = await createProviderCharge({
          reference: String(payment.id),
          amount: Number(payment.amount),
          currency: String(payment.currency),
          description: `Pago de alquiler ${payment.period} (${rental.tenant_name})`,
          customer: {
            name: rental.tenant_name,
            phone: rental.tenant_phone,
            email: rental.tenant_email,
          },
          callbackUrl,
          metadata: { rental_id, period: payment.period },
        });

        const { payment: updated } = await updateRentalPaymentStatusOperation({
          paymentId: String(payment.id),
          status: charge.status === 'pending' ? 'processing' : charge.status,
          providerPaymentId: charge.providerPaymentId,
          providerReference: charge.reference,
          providerCheckoutUrl: charge.checkoutUrl,
          actorUserId: user_id,
        });
        finalPayment = updated;
      } catch (providerError) {
        // Keep the payment as pending so it can be retried; surface a clean error.
        console.error('Payments provider charge failed:', providerError);
        const message = providerError instanceof PaymentsProviderError
          ? providerError.message
          : 'No se pudo iniciar el cobro en la app de pagos';
        await logPublicApiRequest({ context, apiKeyId, status: 502, errorCode: 'business_rule_failed' });
        return publicApiError(context, 'business_rule_failed', message, 502, { payment_id: payment.id }, {
          environment: auth.apiKey!.environment,
          rateLimit: auth.rateLimit,
        });
      }
    }

    const responseBody = { success: true, data: finalPayment, request_id: context.requestId };

    try {
      await emitWebhookEvent(
        {
          eventType: 'rental_payment.created',
          payload: {
            payment_id: finalPayment.id,
            rental_id,
            property_id: finalPayment.property_id,
            amount: Number(finalPayment.amount),
            currency: finalPayment.currency,
            period: finalPayment.period,
            status: finalPayment.status,
            provider: finalPayment.provider,
            provider_payment_id: finalPayment.provider_payment_id ?? null,
            checkout_url: finalPayment.provider_checkout_url ?? null,
            source: 'external_api',
          },
        },
        10
      );
    } catch (webhookError) {
      console.error('Webhook dispatch failed after rental payment creation:', webhookError);
    }

    await persistIdempotencyResponse(auth.apiKey!.id, idempotencyState, 201, responseBody);
    await logPublicApiRequest({ context, apiKeyId, status: 201 });

    return publicApiSuccess(context, finalPayment, {
      status: 201,
      environment: auth.apiKey!.environment,
      rateLimit: auth.rateLimit,
    });

  } catch (error) {
    console.error('API Rental Payments POST Error:', error);
    if (error instanceof Error && error.message) {
      const message = toPublicBusinessErrorMessage(error);
      if (message === 'La operacion no pudo completarse') {
        await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
        return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
          environment: apiEnvironment,
        });
      }
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'business_rule_failed' });
      return publicApiError(context, 'business_rule_failed', message, 400, undefined, {
        environment: apiEnvironment,
      });
    }
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
      environment: apiEnvironment,
    });
  }
}

function buildSandboxPayment(overrides?: {
  rental_id?: string;
  amount?: number;
  currency?: string;
  period?: string;
}) {
  const now = new Date().toISOString();
  return {
    id: '00000000-0000-4000-8000-000000000401',
    rental_id: overrides?.rental_id ?? '00000000-0000-4000-8000-000000000301',
    property_id: '00000000-0000-4000-8000-000000000201',
    period: overrides?.period ?? now.slice(0, 7),
    amount: overrides?.amount ?? 250000,
    currency: overrides?.currency ?? 'XAF',
    status: 'processing' as const,
    provider: getProviderName(),
    provider_payment_id: 'sbx_ch_0001',
    provider_checkout_url: 'https://sandbox.payments.example/checkout/sbx_ch_0001',
    created_at: now,
  };
}
