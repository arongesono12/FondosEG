import 'server-only';

import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exceedsByteLimit, isAllowedSameOriginMutation } from '@/lib/security/request-policy';

export function isSameOriginMutation(request: NextRequest): boolean {
  return isAllowedSameOriginMutation({
    requestHost: request.nextUrl.host,
    origin: request.headers.get('origin'),
    fetchSite: request.headers.get('sec-fetch-site'),
  });
}

export async function readLimitedJson(
  request: NextRequest,
  maxBytes: number
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (contentType !== 'application/json') throw new Error('unsupported_media_type');

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new Error('payload_too_large');
  const raw = await request.text();
  if (exceedsByteLimit(raw, maxBytes)) throw new Error('payload_too_large');
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function consumePublicEndpointRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMinutes = 1
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const salt = process.env.PUBLIC_RATE_LIMIT_SALT?.trim();
  if (!salt && process.env.NODE_ENV === 'production') {
    throw new Error('PUBLIC_RATE_LIMIT_SALT is required in production');
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const fingerprint = createHash('sha256')
    .update(`${salt || 'development-only'}:${scope}:${ip}`)
    .digest('hex');
  const windowMs = Math.max(1, windowMinutes) * 60_000;
  const now = Date.now();
  const windowStartedAtMs = Math.floor(now / windowMs) * windowMs;
  const windowStartedAt = new Date(windowStartedAtMs).toISOString();

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('consume_public_endpoint_rate_limit', {
    p_bucket_key: fingerprint,
    p_window_started_at: windowStartedAt,
    p_limit: limit,
  });
  if (error) throw new Error(`Public rate limit failed: ${error.message}`);

  return {
    allowed: Number(data || 0) <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAtMs + windowMs - now) / 1000)),
  };
}
