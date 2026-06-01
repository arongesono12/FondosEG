import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { generateTransferCode } from '@/lib/utils';
import { createAgentTransferOperation } from '@/lib/server/financial-operations';
import { persistIdempotencyResponse, readIdempotencyState } from '@/lib/server/api-idempotency';
import { createSandboxAgentTransfer } from '@/lib/server/public-api-sandbox';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
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

const transferSchema = z.object({
  sender_name: z.string().trim().min(1, 'sender_name es requerido').max(120),
  sender_phone: z.string().trim().min(1, 'sender_phone es requerido').max(32),
  sender_document_type: z.string().trim().max(40).optional(),
  sender_document_number: z.string().trim().max(80).optional(),
  receiver_name: z.string().trim().min(1, 'receiver_name es requerido').max(120),
  receiver_phone: z.string().trim().min(1, 'receiver_phone es requerido').max(32),
  receiver_document_type: z.string().trim().max(40).optional(),
  receiver_document_number: z.string().trim().max(80).optional(),
  destination_city: z.string().trim().min(1, 'destination_city es requerido').max(100),
  destination_country: z.string().trim().max(80).optional(),
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
    
    if (role_access !== 'gestor') {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(
        context,
        'permission_denied',
        'Solo gestores pueden realizar transferencias',
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
    const parsedBody = transferSchema.safeParse(body);

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
      body
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

    const {
      sender_name,
      sender_phone,
      sender_document_type,
      sender_document_number,
      receiver_name,
      receiver_phone,
      receiver_document_type,
      receiver_document_number,
      destination_city,
      destination_country,
      amount,
      currency = 'XAF',
      notes,
    } = parsedBody.data;

    if (auth.apiKey!.environment === 'test') {
      const sandboxData = createSandboxAgentTransfer({
        amount: Number(amount),
        currency,
        receiverName: receiver_name,
        receiverPhone: receiver_phone,
        destinationCity: destination_city,
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

    const transferCode = generateTransferCode();

    const { transfer } = await createAgentTransferOperation({
      agentId: user_id,
      actorUserId: user_id,
      transferCode,
      senderName: sender_name,
      senderPhone: sender_phone,
      senderDocumentType: sender_document_type,
      senderDocumentNumber: sender_document_number,
      receiverName: receiver_name,
      receiverPhone: receiver_phone,
      receiverDocumentType: receiver_document_type,
      receiverDocumentNumber: receiver_document_number,
      destinationCity: destination_city,
      destinationCountry: destination_country,
      amount: Number(amount),
      currency,
      notes,
    });

    const responseBody = {
      success: true,
      data: {
        transfer_id: (transfer as { id: string }).id,
        transfer_code: transferCode,
        amount,
        currency,
        receiver_name,
        receiver_phone,
        destination_city,
        status: 'available_for_pickup',
        created_at: (transfer as { created_at: string }).created_at,
      },
      request_id: context.requestId,
    };

    try {
      await emitWebhookEvent(
        {
          eventType: 'transfer.created',
          payload: {
            transfer_id: (transfer as { id: string }).id,
            transfer_code: transferCode,
            amount: Number(amount),
            currency,
            status: 'available_for_pickup',
            sender_name,
            sender_phone,
            receiver_name,
            receiver_phone,
            destination_city,
            destination_country: destination_country ?? null,
            source: 'external_api',
          },
        },
        10
      );
    } catch (webhookError) {
      console.error('Webhook dispatch failed after external transfer creation:', webhookError);
    }

    await persistIdempotencyResponse(auth.apiKey!.id, idempotencyState, 201, responseBody);
    await logPublicApiRequest({ context, apiKeyId, status: 201 });

    return publicApiSuccess(context, responseBody.data, {
      status: 201,
      environment: auth.apiKey!.environment,
      rateLimit: auth.rateLimit,
    });

  } catch (error) {
    console.error('API Transfer Error:', error);
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

