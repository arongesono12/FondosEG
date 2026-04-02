import { createAdminClient } from '@/lib/supabase/admin';
import { hashRequestPayload } from '@/lib/server/api-security';

export interface IdempotencyState {
  key: string;
  requestHash: string;
  cachedResponse?: {
    status: number;
    body: unknown;
  };
  conflictMessage?: string;
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

  const { data, error } = await adminClient
    .from('api_idempotency_keys')
    .select('request_hash, response_status, response_body')
    .eq('api_key_id', apiKeyId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Idempotency lookup failed: ${error.message}`);
  }

  if (!data) {
    return { key: idempotencyKey, requestHash };
  }

  if (data.request_hash !== requestHash) {
    return {
      key: idempotencyKey,
      requestHash,
      conflictMessage: 'La misma clave de idempotencia fue usada con un payload distinto',
    };
  }

  if (data.response_status && data.response_body) {
    return {
      key: idempotencyKey,
      requestHash,
      cachedResponse: {
        status: Number(data.response_status),
        body: data.response_body,
      },
    };
  }

  return { key: idempotencyKey, requestHash };
}

export async function persistIdempotencyResponse(
  apiKeyId: string,
  state: IdempotencyState | null,
  responseStatus: number,
  responseBody: unknown
): Promise<void> {
  if (!state) {
    return;
  }

  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  const { error } = await adminClient
    .from('api_idempotency_keys')
    .upsert(
      {
        api_key_id: apiKeyId,
        idempotency_key: state.key,
        request_hash: state.requestHash,
        response_status: responseStatus,
        response_body: responseBody,
        updated_at: nowIso,
      },
      {
        onConflict: 'api_key_id,idempotency_key',
      }
    );

  if (error) {
    throw new Error(`Idempotency persist failed: ${error.message}`);
  }
}

