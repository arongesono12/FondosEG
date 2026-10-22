import { NextRequest } from 'next/server';
import { authorizePaymentsKey } from '@/lib/server/payments-key-auth';
import { getPublicAppBaseUrl } from '@/lib/server/payment-requests';
import {
  createPublicApiContext,
  logPublicApiRequest,
  publicApiError,
  publicApiSuccess,
  readJsonBody,
} from '@/lib/server/public-api';
import { buildWalletLinkAuthorizeUrl, parseCreateWalletLink } from '@/lib/server/wallet-link-rules';
import { createWalletLinkRequest, WalletLinkRejectedError } from '@/lib/server/wallet-links';

/**
 * Solicitud de vínculo de billetera: el integrador pide permiso para leer el
 * saldo de uno de sus usuarios y recibe un `authorize_url` donde ese usuario
 * lo autoriza con su sesión de FondosEG.
 */
export async function POST(request: NextRequest) {
  const context = createPublicApiContext(request);
  const authorized = await authorizePaymentsKey(request, context);
  if ('response' in authorized) return authorized.response;

  const { apiKey, auth } = authorized;
  const responseInit = { environment: apiKey.environment, rateLimit: auth.rateLimit };

  // Un vínculo da acceso a datos reales de un cliente: nunca con una key de test.
  if (apiKey.environment === 'test') {
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 400, errorCode: 'business_rule_failed' });
    return publicApiError(context, 'business_rule_failed',
      'Los vínculos de billetera requieren una credencial de producción', 400, undefined, responseInit);
  }

  try {
    const body = await readJsonBody(request);
    const parsed = body.success ? parseCreateWalletLink(body.data) : null;
    if (!body.success || !parsed?.success) {
      const details = !body.success ? body.details : parsed && !parsed.success ? parsed.details : undefined;
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 400, errorCode: 'validation_error' });
      return publicApiError(context, 'validation_error', 'Payload invalido', 400, details, responseInit);
    }

    const linkRequest = await createWalletLinkRequest({
      apiKeyId: apiKey.id,
      merchantUserId: apiKey.user_id,
      input: parsed.data,
    });

    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 201 });
    return publicApiSuccess(context, {
      id: linkRequest.id,
      authorize_url: buildWalletLinkAuthorizeUrl(getPublicAppBaseUrl(request.url), linkRequest.id),
      expires_at: linkRequest.expires_at,
    }, { ...responseInit, status: 201 });
  } catch (error) {
    if (error instanceof WalletLinkRejectedError) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 400, errorCode: 'business_rule_failed' });
      return publicApiError(context, 'business_rule_failed', error.message, 400, undefined, responseInit);
    }
    console.error('API Wallet Links POST Error:', error);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, responseInit);
  }
}
