import { NextRequest } from 'next/server';
import { authorizePaymentsKey } from '@/lib/server/payments-key-auth';
import {
  createPublicApiContext,
  logPublicApiRequest,
  publicApiError,
  publicApiSuccess,
} from '@/lib/server/public-api';
import { isWalletLinkToken } from '@/lib/server/wallet-link-rules';
import { findActiveWalletLinkByToken, readWalletLinkBalance } from '@/lib/server/wallet-links';

/**
 * Saldo disponible del cliente que vinculó su billetera. Exige la API key del
 * comercio Y el token del vínculo: el token solo sirve a quien lo obtuvo.
 */
export async function GET(request: NextRequest) {
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

  const token = request.headers.get('x-wallet-link-token')?.trim() ?? '';
  if (!isWalletLinkToken(token)) {
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 401, errorCode: 'link_revoked' });
    return publicApiError(context, 'link_revoked', 'El vínculo de billetera no es válido', 401, undefined, responseInit);
  }

  try {
    const link = await findActiveWalletLinkByToken(token, apiKey.user_id);
    if (!link) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 401, errorCode: 'link_revoked' });
      return publicApiError(context, 'link_revoked',
        'El vínculo de billetera fue revocado o no existe', 401, undefined, responseInit);
    }

    const balance = await readWalletLinkBalance(link);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 200 });
    return publicApiSuccess(context, balance, responseInit);
  } catch (error) {
    console.error('API Wallet Links balance Error:', error);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, responseInit);
  }
}
