import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type PublicApiErrorCode =
  | 'authentication_required'
  | 'invalid_credentials'
  | 'rate_limit_exceeded'
  | 'permission_denied'
  | 'validation_error'
  | 'idempotency_conflict'
  | 'not_found'
  | 'business_rule_failed'
  | 'internal_error';

export interface PublicApiContext {
  requestId: string;
  startedAt: number;
  method: string;
  path: string;
}

interface LogApiRequestParams {
  context: PublicApiContext;
  apiKeyId?: string | null;
  status: number;
  errorCode?: PublicApiErrorCode;
}

export function createPublicApiContext(request: NextRequest): PublicApiContext {
  return {
    requestId: request.headers.get('x-request-id') || randomUUID(),
    startedAt: Date.now(),
    method: request.method,
    path: new URL(request.url).pathname,
  };
}

export function publicApiSuccess(
  context: PublicApiContext,
  data: unknown,
  init?: {
    status?: number;
    pagination?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  }
) {
  const status = init?.status || 200;
  return NextResponse.json(
    {
      success: true,
      data,
      ...(init?.pagination ? { pagination: init.pagination } : {}),
      ...(init?.meta ? { meta: init.meta } : {}),
      request_id: context.requestId,
    },
    {
      status,
      headers: {
        'x-request-id': context.requestId,
      },
    }
  );
}

export function publicApiError(
  context: PublicApiContext,
  code: PublicApiErrorCode,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      request_id: context.requestId,
    },
    {
      status,
      headers: {
        'x-request-id': context.requestId,
      },
    }
  );
}

export function mapAuthErrorStatus(status?: number): PublicApiErrorCode {
  if (status === 429) return 'rate_limit_exceeded';
  return 'invalid_credentials';
}

export async function logPublicApiRequest({
  context,
  apiKeyId,
  status,
  errorCode,
}: LogApiRequestParams): Promise<void> {
  try {
    const adminClient = createAdminClient();
    await adminClient.from('api_request_logs').insert({
      api_key_id: apiKeyId ?? null,
      request_id: context.requestId,
      method: context.method,
      path: context.path,
      status_code: status,
      error_code: errorCode ?? null,
      latency_ms: Date.now() - context.startedAt,
    });
  } catch (error) {
    console.error('Public API request log failed:', error);
  }
}
