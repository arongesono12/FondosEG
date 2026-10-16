import { NextRequest } from 'next/server';
import { authorizePaymentsKey } from '@/lib/server/payments-key-auth';
import { toPublicPaymentRequest } from '@/lib/server/payment-requests-contract';
import {
  cancelPendingPaymentRequest,
  emitPaymentRequestEvent,
  findPaymentRequestById,
  getPublicAppBaseUrl,
} from '@/lib/server/payment-requests';
import {
  createPublicApiContext,
  logPublicApiRequest,
  publicApiError,
  publicApiSuccess,
} from '@/lib/server/public-api';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

/** Estado de una solicitud propia. Lo usa el integrador para conciliar sin depender del webhook. */
export async function GET(request: NextRequest, routeContext: RouteContext) {
  const context = createPublicApiContext(request);
  const authorized = await authorizePaymentsKey(request, context);
  if ('response' in authorized) return authorized.response;

  const { apiKey, auth } = authorized;
  const responseInit = { environment: apiKey.environment, rateLimit: auth.rateLimit };
  const { id } = await routeContext.params;

  try {
    // Una key de test nunca lee datos reales.
    const paymentRequest = UUID_PATTERN.test(id) && apiKey.environment !== 'test'
      ? await findPaymentRequestById(id)
      : null;
    if (!paymentRequest || paymentRequest.merchant_user_id !== apiKey.user_id) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 404, errorCode: 'not_found' });
      return publicApiError(context, 'not_found', 'La solicitud de cobro no existe', 404, undefined, responseInit);
    }

    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 200 });
    return publicApiSuccess(context, toPublicPaymentRequest(paymentRequest, getPublicAppBaseUrl(request.url)), responseInit);
  } catch (error) {
    console.error('API Payment Request GET Error:', error);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, responseInit);
  }
}

/** El comercio retira una solicitud que todavía no se ha pagado. */
export async function DELETE(request: NextRequest, routeContext: RouteContext) {
  const context = createPublicApiContext(request);
  const authorized = await authorizePaymentsKey(request, context);
  if ('response' in authorized) return authorized.response;

  const { apiKey, auth } = authorized;
  const responseInit = { environment: apiKey.environment, rateLimit: auth.rateLimit };
  const { id } = await routeContext.params;

  try {
    // Una key de test nunca modifica datos reales.
    const cancelled = UUID_PATTERN.test(id) && apiKey.environment !== 'test'
      ? await cancelPendingPaymentRequest(id, { merchantUserId: apiKey.user_id })
      : null;

    if (!cancelled) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 409, errorCode: 'business_rule_failed' });
      return publicApiError(context, 'business_rule_failed',
        'La solicitud no existe o ya no está pendiente', 409, undefined, responseInit);
    }

    await emitPaymentRequestEvent('payment_request.cancelled', cancelled);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 200 });
    return publicApiSuccess(context, toPublicPaymentRequest(cancelled, getPublicAppBaseUrl(request.url)), responseInit);
  } catch (error) {
    console.error('API Payment Request DELETE Error:', error);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, responseInit);
  }
}
