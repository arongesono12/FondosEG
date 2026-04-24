import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { generateTransferCode } from '@/lib/utils';
import { createAgentTransferOperation } from '@/lib/server/financial-operations';
import { persistIdempotencyResponse, readIdempotencyState } from '@/lib/server/api-idempotency';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import {
  createPublicApiContext,
  logPublicApiRequest,
  mapAuthErrorStatus,
  publicApiError,
  publicApiSuccess,
} from '@/lib/server/public-api';

const transferSchema = z.object({
  sender_name: z.string().trim().min(1, 'sender_name es requerido'),
  sender_phone: z.string().trim().min(1, 'sender_phone es requerido'),
  sender_document_type: z.string().trim().optional(),
  sender_document_number: z.string().trim().optional(),
  receiver_name: z.string().trim().min(1, 'receiver_name es requerido'),
  receiver_phone: z.string().trim().min(1, 'receiver_phone es requerido'),
  receiver_document_type: z.string().trim().optional(),
  receiver_document_number: z.string().trim().optional(),
  destination_city: z.string().trim().min(1, 'destination_city es requerido'),
  destination_country: z.string().trim().optional(),
  amount: z.coerce.number().positive('amount debe ser mayor a 0'),
  currency: z.string().trim().default('XAF'),
  notes: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const context = createPublicApiContext(request);
  let apiKeyId: string | null = null;

  try {
    const auth = await authenticateAPIKey(request);
    
    if (!auth.success) {
      const status = auth.status || 401;
      const code = mapAuthErrorStatus(status);
      await logPublicApiRequest({ context, status, errorCode: code });
      return publicApiError(context, code, auth.error || 'Credenciales invalidas', status);
    }
    apiKeyId = auth.apiKey!.id;

    if (!await requirePermission(auth, 'transfer')) {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: transfer', 403);
    }

    const { user_id, role_access } = auth.apiKey!;
    
    if (role_access !== 'gestor') {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Solo gestores pueden realizar transferencias', 403);
    }

    const body = await request.json();
    const parsedBody = transferSchema.safeParse(body);

    if (!parsedBody.success) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(
        context,
        'validation_error',
        'Payload invalido',
        400,
        parsedBody.error.flatten().fieldErrors
      );
    }

    const idempotencyState = await readIdempotencyState(
      auth.apiKey!.id,
      request.headers.get('idempotency-key'),
      body
    );

    if (idempotencyState?.conflictMessage) {
      await logPublicApiRequest({ context, apiKeyId, status: 409, errorCode: 'idempotency_conflict' });
      return publicApiError(context, 'idempotency_conflict', idempotencyState.conflictMessage, 409);
    }

    if (idempotencyState?.cachedResponse) {
      await logPublicApiRequest({ context, apiKeyId, status: idempotencyState.cachedResponse.status });
      return NextResponse.json(idempotencyState.cachedResponse.body, {
        status: idempotencyState.cachedResponse.status,
        headers: { 'x-request-id': context.requestId },
      });
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

    await persistIdempotencyResponse(auth.apiKey!.id, idempotencyState, 200, responseBody);
    await logPublicApiRequest({ context, apiKeyId, status: 200 });

    return publicApiSuccess(context, responseBody.data);

  } catch (error) {
    console.error('API Transfer Error:', error);
    if (error instanceof Error && error.message) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'business_rule_failed' });
      return publicApiError(context, 'business_rule_failed', error.message, 400);
    }
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500);
  }
}

