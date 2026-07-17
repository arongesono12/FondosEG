import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { persistIdempotencyResponse, readIdempotencyState } from '@/modules/public-api/application/idempotency';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import { createSandboxWalletTransfer } from '@/lib/server/public-api-sandbox';
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
import { createWalletTransferDirectOperation } from '@/modules/transfers/application';

const walletTransferSchema = z.object({
  receiver_phone: z.string().trim().min(1, 'receiver_phone es requerido').max(32),
  receiver_name: z.string().trim().min(1, 'receiver_name es requerido').max(120),
  amount: z.coerce.number().positive('amount debe ser mayor a 0').max(10000000),
  currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/).default('XAF'),
  notes: z.string().trim().max(500).optional(),
}).strict();

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

    if (!await requirePermission(auth, 'transfer')) {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: transfer', 403, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const { user_id, role_access } = auth.apiKey!;
    
    if (role_access !== 'cliente') {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(
        context,
        'permission_denied',
        'Solo clientes pueden realizar transferencias entre billeteras',
        403,
        undefined,
        { environment: auth.apiKey!.environment, rateLimit: auth.rateLimit }
      );
    }

    const jsonBody = await readJsonBody(request);
    if (!jsonBody.success) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(context, 'validation_error', 'Payload invalido', 400, jsonBody.details, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
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
        { environment: auth.apiKey!.environment, rateLimit: auth.rateLimit }
      );
    }

    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return publicApiError(context, 'validation_error', 'El header idempotency-key es obligatorio', 400);
    }
    const idempotencyState = await readIdempotencyState(
      auth.apiKey!.id,
      idempotencyKey,
      body
    );

    if (idempotencyState?.conflictMessage) {
      await logPublicApiRequest({ context, apiKeyId, status: 409, errorCode: 'idempotency_conflict' });
      return publicApiError(context, 'idempotency_conflict', idempotencyState.conflictMessage, 409, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    if (idempotencyState?.processing) {
      return publicApiError(context, 'idempotency_conflict', 'Una solicitud con esta clave sigue en proceso', 409);
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

    const {
      receiver_phone,
      receiver_name,
      amount,
      currency = 'XAF',
      notes,
    } = parsedBody.data;

    if (auth.apiKey!.environment === 'test') {
      const sandboxData = createSandboxWalletTransfer({
        amount,
        currency,
        receiverName: receiver_name,
        receiverPhone: receiver_phone,
      });
      const responseBody = {
        success: true,
        data: sandboxData,
        request_id: context.requestId,
      };

      await persistIdempotencyResponse(auth.apiKey!.id, idempotencyState, 201, responseBody);
      await logPublicApiRequest({ context, apiKeyId, status: 201 });
      return publicApiSuccess(context, sandboxData, {
        status: 201,
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const { transfer, new_balance } = await createWalletTransferDirectOperation({
      senderId: user_id,
      receiverName: receiver_name,
      receiverPhone: receiver_phone,
      amount,
      currency,
      notes,
      originChannel: 'external_api',
    });

    const responseBody = {
      success: true,
      data: {
        transfer_id: (transfer as { id: string }).id,
        transfer_type: 'wallet',
        amount,
        currency,
        sender_name: (transfer as { sender_name: string }).sender_name,
        sender_phone: (transfer as { sender_phone: string }).sender_phone,
        receiver_name: receiver_name,
        receiver_phone: receiver_phone,
        status: 'completed',
        created_at: (transfer as { created_at: string }).created_at,
        new_balance,
      },
      request_id: context.requestId,
    };

    try {
      await emitWebhookEvent(
        {
          eventType: 'wallet_transfer.confirmed',
          payload: {
            transfer_id: (transfer as { id: string }).id,
            amount,
            currency,
            status: 'confirmed',
            sender_name: (transfer as { sender_name: string }).sender_name,
            sender_phone: (transfer as { sender_phone: string }).sender_phone,
            receiver_name,
            receiver_phone,
            confirmed_at: (transfer as { confirmed_at?: string }).confirmed_at ?? null,
            source: 'external_api',
          },
        },
        10
      );
    } catch (webhookError) {
      console.error('Webhook dispatch failed after external wallet transfer:', webhookError);
    }

    await persistIdempotencyResponse(auth.apiKey!.id, idempotencyState, 201, responseBody);
    await logPublicApiRequest({ context, apiKeyId, status: 201 });

    return publicApiSuccess(context, responseBody.data, {
      status: 201,
      environment: auth.apiKey!.environment,
      rateLimit: auth.rateLimit,
    });

  } catch (error) {
    console.error('API Wallet Transfer Error:', error);
    if (error instanceof Error && error.message) {
      const message = toPublicBusinessErrorMessage(error);
      if (message === 'La operacion no pudo completarse') {
        await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
        return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
          environment: apiEnvironment,
        });
      }

      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'business_rule_failed' });
      return publicApiError(
        context,
        'business_rule_failed',
        message,
        400,
        undefined,
        { environment: apiEnvironment }
      );
    }
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
      environment: apiEnvironment,
    });
  }
}

