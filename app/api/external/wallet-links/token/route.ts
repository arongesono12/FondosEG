import { NextRequest } from 'next/server';
import { authorizePaymentsKey } from '@/lib/server/payments-key-auth';
import {
  createPublicApiContext,
  logPublicApiRequest,
  publicApiError,
  publicApiSuccess,
  readJsonBody,
} from '@/lib/server/public-api';
import { parseRedeemCode } from '@/lib/server/wallet-link-rules';
import { redeemWalletLinkCode, WalletLinkRejectedError } from '@/lib/server/wallet-links';

/**
 * Canje del código de un solo uso por el token `balance:read`. El token en
 * claro solo viaja en esta respuesta: FondosEG guarda únicamente su hash.
 */
export async function POST(request: NextRequest) {
  const context = createPublicApiContext(request);
  const authorized = await authorizePaymentsKey(request, context);
  if ('response' in authorized) return authorized.response;

  const { apiKey, auth } = authorized;
  const responseInit = { environment: apiKey.environment, rateLimit: auth.rateLimit };

  if (apiKey.environment === 'test') {
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 400, errorCode: 'business_rule_failed' });
    return publicApiError(context, 'business_rule_failed',
      'Los vínculos de billetera requieren una credencial de producción', 400, undefined, responseInit);
  }

  try {
    const body = await readJsonBody(request);
    const parsed = body.success ? parseRedeemCode(body.data) : null;
    if (!body.success || !parsed?.success) {
      const details = !body.success ? body.details : parsed && !parsed.success ? parsed.details : undefined;
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 400, errorCode: 'validation_error' });
      return publicApiError(context, 'validation_error', 'Payload invalido', 400, details, responseInit);
    }

    const link = await redeemWalletLinkCode({
      code: parsed.data.code,
      merchantUserId: apiKey.user_id,
      apiKeyId: apiKey.id,
      environment: apiKey.environment,
    });

    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 201 });
    return publicApiSuccess(context, link, { ...responseInit, status: 201 });
  } catch (error) {
    if (error instanceof WalletLinkRejectedError) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 409, errorCode: 'business_rule_failed' });
      return publicApiError(context, 'business_rule_failed', error.message, 409, undefined, responseInit);
    }
    console.error('API Wallet Links token Error:', error);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, responseInit);
  }
}
