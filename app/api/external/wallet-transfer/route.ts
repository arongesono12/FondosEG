import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { persistIdempotencyResponse, readIdempotencyState } from '@/lib/server/api-idempotency';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import {
  createPublicApiContext,
  logPublicApiRequest,
  mapAuthErrorStatus,
  publicApiError,
  publicApiSuccess,
} from '@/lib/server/public-api';
import { createWalletTransferDirectOperation } from '@/lib/server/financial-operations';

const walletTransferSchema = z.object({
  receiver_phone: z.string().trim().min(1, 'receiver_phone es requerido'),
  receiver_name: z.string().trim().min(1, 'receiver_name es requerido'),
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
    
    if (role_access !== 'cliente') {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Solo clientes pueden realizar transferencias entre billeteras', 403);
    }

    const body = await request.json();
    const parsedBody = walletTransferSchema.safeParse(body);

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
      receiver_phone,
      receiver_name,
      amount,
      currency = 'XAF',
      notes,
    } = parsedBody.data;

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

    await persistIdempotencyResponse(auth.apiKey!.id, idempotencyState, 200, responseBody);
    await logPublicApiRequest({ context, apiKeyId, status: 200 });

    return publicApiSuccess(context, responseBody.data);

  } catch (error) {
    console.error('API Wallet Transfer Error:', error);
    if (error instanceof Error && error.message) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'business_rule_failed' });
      return publicApiError(context, 'business_rule_failed', error.message, 400);
    }
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500);
  }
}

