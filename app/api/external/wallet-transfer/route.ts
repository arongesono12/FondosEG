import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import {
  persistIdempotencyResponse,
  readIdempotencyState,
  releaseIdempotencyKey,
} from '@/modules/public-api/application/idempotency';
import { createSandboxWalletTransfer } from '@/lib/server/public-api-sandbox';
import {
  createPublicApiContext,
  logPublicApiRequest,
  mapAuthErrorStatus,
  publicApiCachedResponse,
  publicApiError,
  publicApiSuccess,
  readJsonBody,
} from '@/lib/server/public-api';
import { settleClientWalletTransfer, type SettleWalletTransferErrorCode } from '@/services/wallet-transfer';

/**
 * Envío desde la billetera de la aplicación a la de un cliente FondosEG (p. ej.
 * CasasEG liquidando el alquiler a un propietario). Usa EXACTAMENTE el mismo
 * flujo que el envío del panel: teléfono normalizado, saldo disponible, una
 * sola divisa, consentimiento CEMAC y liquidación atómica.
 */
const walletTransferSchema = z.object({
  receiver_phone: z.string().trim().min(6, 'receiver_phone es requerido').max(32),
  receiver_name: z.string().trim().min(1, 'receiver_name es requerido').max(120),
  amount: z.coerce.number().positive('amount debe ser mayor a 0').max(10000000),
  currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/).optional(),
  /** Referencia propia del integrador (p. ej. id del pago en CasasEG). */
  reference: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();

/** Rechazos de negocio: nada se movió y el integrador sabe qué corregir. */
const REJECTION_STATUS: Record<SettleWalletTransferErrorCode, number> = {
  invalid_amount: 400,
  sender_not_allowed: 403,
  receiver_not_found: 422,
  receiver_inactive: 422,
  currency_mismatch: 422,
  insufficient_funds: 422,
  rejected: 422,
};

function buildNotes(reference?: string, notes?: string): string | null {
  const parts = [reference ? `Ref: ${reference}` : null, notes || null].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ').slice(0, 500) : null;
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
    const apiKey = auth.apiKey!;
    apiKeyId = apiKey.id;
    apiEnvironment = apiKey.environment;
    const responseInit = { environment: apiKey.environment, rateLimit: auth.rateLimit };

    if (!await requirePermission(auth, 'transfer')) {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: transfer', 403, undefined, responseInit);
    }

    if (apiKey.role_access !== 'cliente') {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(
        context,
        'permission_denied',
        'Esta credencial no opera una billetera de cliente. Emite una credencial para tu aplicación en el portal.',
        403,
        undefined,
        responseInit
      );
    }

    const jsonBody = await readJsonBody(request);
    if (!jsonBody.success) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(context, 'validation_error', 'Payload invalido', 400, jsonBody.details, responseInit);
    }

    const body = jsonBody.data;
    const parsedBody = walletTransferSchema.safeParse(body);

    if (!parsedBody.success) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(
        context,
        'validation_error',
        'Payload invalido',
        400,
        parsedBody.error.flatten().fieldErrors,
        responseInit
      );
    }

    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(context, 'validation_error', 'El header idempotency-key es obligatorio', 400, undefined, responseInit);
    }
    const idempotencyState = await readIdempotencyState(apiKey.id, idempotencyKey, body);

    if (idempotencyState?.conflictMessage) {
      await logPublicApiRequest({ context, apiKeyId, status: 409, errorCode: 'idempotency_conflict' });
      return publicApiError(context, 'idempotency_conflict', idempotencyState.conflictMessage, 409, undefined, responseInit);
    }

    if (idempotencyState?.processing) {
      await logPublicApiRequest({ context, apiKeyId, status: 409, errorCode: 'idempotency_conflict' });
      return publicApiError(context, 'idempotency_conflict', 'Una solicitud con esta clave sigue en proceso', 409, undefined, responseInit);
    }

    if (idempotencyState?.cachedResponse) {
      await logPublicApiRequest({ context, apiKeyId, status: idempotencyState.cachedResponse.status });
      return publicApiCachedResponse(
        context,
        idempotencyState.cachedResponse.body,
        idempotencyState.cachedResponse.status,
        responseInit
      );
    }

    const { receiver_phone, receiver_name, amount, currency, reference, notes } = parsedBody.data;

    if (apiKey.environment === 'test') {
      const sandboxData = {
        ...createSandboxWalletTransfer({
          amount,
          currency: currency ?? 'XAF',
          receiverName: receiver_name,
          receiverPhone: receiver_phone,
        }),
        reference: reference ?? null,
      };
      const responseBody = { success: true, data: sandboxData, request_id: context.requestId };

      await persistIdempotencyResponse(apiKey.id, idempotencyState, 201, responseBody);
      await logPublicApiRequest({ context, apiKeyId, status: 201 });
      return publicApiSuccess(context, sandboxData, { ...responseInit, status: 201 });
    }

    const result = await settleClientWalletTransfer(
      apiKey.user_id,
      {
        receiverPhone: receiver_phone,
        receiverName: receiver_name,
        amount,
        currency,
        notes: buildNotes(reference, notes),
      },
      {
        originChannel: 'external_api',
        consentChannel: 'external_api',
        webhookSource: 'external_api',
        // La billetera de una aplicación no tiene teléfono: el recibo lleva su nombre.
        requireSenderPhone: false,
        requestEvidence: {
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: request.headers.get('user-agent'),
        },
      }
    );

    if (!result.success) {
      if (result.outcomeUnknown) {
        // No se libera la clave: el integrador debe reintentar con la MISMA
        // idempotency-key y consultar el historial antes de enviar otra vez.
        await logPublicApiRequest({ context, apiKeyId, status: 503, errorCode: 'internal_error' });
        return publicApiError(
          context,
          'internal_error',
          'No se pudo confirmar el resultado del envío. Reintenta con la misma idempotency-key.',
          503,
          undefined,
          responseInit
        );
      }

      // Nada se movió: la misma clave puede reutilizarse tras corregir el problema.
      await releaseIdempotencyKey(apiKey.id, idempotencyState);
      const status = REJECTION_STATUS[result.code];
      const errorCode = status === 403 ? 'permission_denied' : status === 400 ? 'validation_error' : 'business_rule_failed';
      await logPublicApiRequest({ context, apiKeyId, status, errorCode });
      return publicApiError(context, errorCode, result.error, status, { reason: result.code }, responseInit);
    }

    const { transfer } = result;
    const data = {
      transfer_id: transfer.id,
      transfer_type: 'wallet',
      reference: reference ?? null,
      amount: Number(transfer.amount),
      currency: transfer.currency,
      sender_name: transfer.sender_name,
      receiver_name: transfer.receiver_name,
      receiver_phone: transfer.receiver_phone,
      status: 'completed',
      created_at: transfer.created_at,
      confirmed_at: transfer.confirmed_at ?? null,
      new_balance: result.availableBalance,
    };
    const responseBody = { success: true, data, request_id: context.requestId };

    await persistIdempotencyResponse(apiKey.id, idempotencyState, 201, responseBody);
    await logPublicApiRequest({ context, apiKeyId, status: 201 });
    return publicApiSuccess(context, data, { ...responseInit, status: 201 });
  } catch (error) {
    console.error('API Wallet Transfer Error:', error);
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
      environment: apiEnvironment,
    });
  }
}
