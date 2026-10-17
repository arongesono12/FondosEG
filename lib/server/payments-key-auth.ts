import 'server-only';
import { NextRequest } from 'next/server';
import { authenticateAPIKey, requirePermission, type APIKeyAuthResult } from '@/lib/api-auth';
import {
  logPublicApiRequest,
  mapAuthErrorStatus,
  publicApiError,
  type PublicApiContext,
} from '@/lib/server/public-api';

export type AuthorizedApiKey = NonNullable<APIKeyAuthResult['apiKey']>;

/**
 * Autentica la API key y exige el permiso `payments`. Devuelve la respuesta de
 * error ya registrada cuando no procede, para que la ruta solo la reenvíe.
 */
export async function authorizePaymentsKey(
  request: NextRequest,
  context: PublicApiContext
): Promise<{ apiKey: AuthorizedApiKey; auth: APIKeyAuthResult } | { response: Response }> {
  let auth: APIKeyAuthResult;
  try {
    auth = await authenticateAPIKey(request);
  } catch (error) {
    // Un fallo de infraestructura (p. ej. una RPC ausente en la base de datos)
    // no debe escapar como un 500 sin cuerpo: el integrador necesita el
    // request_id para reportarlo.
    console.error('API key authentication failed:', error);
    await logPublicApiRequest({ context, status: 500, errorCode: 'internal_error' });
    return {
      response: publicApiError(context, 'internal_error', 'No se pudo verificar la credencial; inténtalo más tarde', 500),
    };
  }

  if (!auth.success || !auth.apiKey) {
    const status = auth.status || 401;
    const code = auth.errorCode || mapAuthErrorStatus(status);
    await logPublicApiRequest({ context, status, errorCode: code });
    return {
      response: publicApiError(context, code, auth.error || 'Credenciales invalidas', status, undefined, {
        rateLimit: auth.rateLimit,
      }),
    };
  }

  if (!await requirePermission(auth, 'payments')) {
    await logPublicApiRequest({ context, apiKeyId: auth.apiKey.id, status: 403, errorCode: 'permission_denied' });
    return {
      response: publicApiError(context, 'permission_denied', 'Permiso denegado: payments', 403, undefined, {
        environment: auth.apiKey.environment,
        rateLimit: auth.rateLimit,
      }),
    };
  }

  return { apiKey: auth.apiKey, auth };
}
