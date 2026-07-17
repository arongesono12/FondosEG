import { createAdminClient } from '@/lib/supabase/admin';
import { hashRequestPayload } from '@/lib/server/api-security';
import { randomUUID } from 'crypto';

export interface IdempotencyState {
  key: string;
  requestHash: string;
  cachedResponse?: {
    status: number;
    body: unknown;
  };
  conflictMessage?: string;
  processing?: boolean;
  lockToken?: string;
}

export async function readIdempotencyState(
  apiKeyId: string,
  idempotencyKey: string | null,
  body: unknown
): Promise<IdempotencyState | null> {
  if (!idempotencyKey) {
    return null;
  }

  const adminClient = createAdminClient();
  const requestHash = hashRequestPayload(body);

  if (idempotencyKey.length > 200) {
    return { key: idempotencyKey, requestHash, conflictMessage: 'La clave de idempotencia es demasiado larga' };
  }

  const lockToken = randomUUID();
  const { data, error } = await adminClient.rpc('claim_api_idempotency_key', {
    p_api_key_id: apiKeyId,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_lock_token: lockToken,
  });

  if (error) {
    throw new Error(`Idempotency lookup failed: ${error.message}`);
  }

  const result = data as {
    state?: 'acquired' | 'conflict' | 'completed' | 'processing';
    response_status?: number;
    response_body?: unknown;
  } | null;

  if (result?.state === 'conflict') {
    return {
      key: idempotencyKey,
      requestHash,
      conflictMessage: 'La misma clave de idempotencia fue usada con un payload distinto',
    };
  }

  if (result?.state === 'completed' && result.response_status && result.response_body) {
    return {
      key: idempotencyKey,
      requestHash,
      cachedResponse: {
        status: Number(result.response_status),
        body: result.response_body,
      },
    };
  }

  if (result?.state === 'processing') {
    return { key: idempotencyKey, requestHash, processing: true };
  }

  if (result?.state !== 'acquired') {
    throw new Error('Idempotency claim returned an invalid state');
  }

  return { key: idempotencyKey, requestHash, lockToken };
}

export async function persistIdempotencyResponse(
  apiKeyId: string,
  state: IdempotencyState | null,
  responseStatus: number,
  responseBody: unknown
): Promise<void> {
  if (!state || !state.lockToken) {
    return;
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('complete_api_idempotency_key', {
    p_api_key_id: apiKeyId,
    p_idempotency_key: state.key,
    p_lock_token: state.lockToken,
    p_response_status: responseStatus,
    p_response_body: responseBody,
  });

  if (error) {
    throw new Error(`Idempotency persist failed: ${error.message}`);
  }
  if (data !== true) {
    throw new Error('Idempotency claim was lost before completion');
  }
}

