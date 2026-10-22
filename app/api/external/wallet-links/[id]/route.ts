import { NextRequest } from 'next/server';
import { authorizePaymentsKey } from '@/lib/server/payments-key-auth';
import {
  createPublicApiContext,
  logPublicApiRequest,
  publicApiError,
  publicApiSuccess,
} from '@/lib/server/public-api';
import { revokeWalletLink } from '@/lib/server/wallet-links';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

/** El comercio revoca un vínculo propio (p. ej. el usuario lo desvinculó en su app). */
export async function DELETE(request: NextRequest, routeContext: RouteContext) {
  const context = createPublicApiContext(request);
  const authorized = await authorizePaymentsKey(request, context);
  if ('response' in authorized) return authorized.response;

  const { apiKey, auth } = authorized;
  const responseInit = { environment: apiKey.environment, rateLimit: auth.rateLimit };
  const { id } = await routeContext.params;

  try {
    // Una key de test nunca modifica datos reales.
    const revoked = UUID_PATTERN.test(id) && apiKey.environment !== 'test'
      ? await revokeWalletLink({ linkId: id, by: 'merchant', ownerUserId: apiKey.user_id })
      : null;

    if (!revoked) {
      await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 404, errorCode: 'not_found' });
      return publicApiError(context, 'not_found', 'El vínculo no existe o ya estaba revocado', 404, undefined, responseInit);
    }

    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 200 });
    return publicApiSuccess(context, { id: revoked.id, revoked_at: revoked.revoked_at }, responseInit);
  } catch (error) {
    console.error('API Wallet Links DELETE Error:', error);
    await logPublicApiRequest({ context, apiKeyId: apiKey.id, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, responseInit);
  }
}
