import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiEnvironment } from '@/lib/server/api-environments';
import { createAdminClient } from '@/lib/supabase/admin';

export const PUBLIC_API_VERSION = 'v1';

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

export interface PublicApiRateLimitHeaders {
  limit?: number;
  remaining?: number;
  resetAt?: string;
  retryAfterSeconds?: number;
}

interface LogApiRequestParams {
  context: PublicApiContext;
  apiKeyId?: string | null;
  status: number;
  errorCode?: PublicApiErrorCode;
}

interface PublicApiResponseOptions {
  status?: number;
  pagination?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  cache?: 'no-store' | 'public-docs';
  environment?: ApiEnvironment;
  rateLimit?: PublicApiRateLimitHeaders;
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
  init?: PublicApiResponseOptions
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
      headers: createPublicApiHeaders(context, init),
    }
  );
}

export function publicApiError(
  context: PublicApiContext,
  code: PublicApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
  init?: PublicApiResponseOptions
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
      headers: createPublicApiHeaders(context, { ...init, status }),
    }
  );
}

export function publicApiCachedResponse(
  context: PublicApiContext,
  body: unknown,
  status: number,
  init?: PublicApiResponseOptions
) {
  return NextResponse.json(body, {
    status,
    headers: createPublicApiHeaders(context, init),
  });
}

export function publicApiDocumentationResponse(body: unknown) {
  const context: PublicApiContext = {
    requestId: randomUUID(),
    startedAt: Date.now(),
    method: 'GET',
    path: '/api/docs/openapi.json',
  };

  return NextResponse.json(body, {
    headers: createPublicApiHeaders(context, { cache: 'public-docs' }),
  });
}

export async function readJsonBody(request: NextRequest): Promise<
  | { success: true; data: unknown }
  | { success: false; details: { body: string[] } }
> {
  try {
    return { success: true, data: await request.json() };
  } catch {
    return {
      success: false,
      details: { body: ['El cuerpo debe ser JSON valido'] },
    };
  }
}

export function toPublicBusinessErrorMessage(
  error: unknown,
  fallback = 'La operacion no pudo completarse'
): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return fallback;
  }

  const message = error.message.trim();
  const unsafePatterns = [
    /duplicate key/i,
    /violates/i,
    /relation/i,
    /column/i,
    /function .* does not exist/i,
    /invalid input syntax/i,
    /schema/i,
    /sql/i,
    /jwt/i,
    /service_role/i,
    /stack/i,
  ];

  if (message.length > 180 || unsafePatterns.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message;
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

export function createPublicApiHeaders(
  context: PublicApiContext,
  init?: PublicApiResponseOptions
): HeadersInit {
  const headers: Record<string, string> = {
    'x-request-id': context.requestId,
    'x-api-version': PUBLIC_API_VERSION,
  };

  if (init?.environment) {
    headers['x-api-environment'] = init.environment;
  }

  if (init?.cache === 'public-docs') {
    headers['cache-control'] = 'public, max-age=300, stale-while-revalidate=3600';
  } else {
    headers['cache-control'] = 'no-store, max-age=0';
    headers.pragma = 'no-cache';
    headers.vary = 'x-api-key';
  }

  if (init?.rateLimit?.limit !== undefined) {
    headers['x-ratelimit-limit'] = String(init.rateLimit.limit);
  }

  if (init?.rateLimit?.remaining !== undefined) {
    headers['x-ratelimit-remaining'] = String(init.rateLimit.remaining);
  }

  if (init?.rateLimit?.resetAt) {
    headers['x-ratelimit-reset'] = init.rateLimit.resetAt;
  }

  if (init?.rateLimit?.retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(init.rateLimit.retryAfterSeconds);
  }

  return headers;
}
