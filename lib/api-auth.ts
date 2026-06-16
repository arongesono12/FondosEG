import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeApiEnvironment, type ApiEnvironment } from '@/lib/server/api-environments';
import { verifyApiSecret } from '@/lib/server/api-security';
import type { PublicApiErrorCode, PublicApiRateLimitHeaders } from '@/lib/server/public-api';
import { NextRequest } from 'next/server';

export interface APIKeyAuthResult {
  success: boolean;
  apiKey?: {
    id: string;
    app_name: string;
    user_id: string;
    environment: ApiEnvironment;
    role_access: string;
    permissions: {
      balance: boolean;
      transfer: boolean;
      history: boolean;
      properties: boolean;
      payments: boolean;
    };
    rate_limit: number;
  };
  errorCode?: PublicApiErrorCode;
  error?: string;
  status?: number;
  rateLimit?: PublicApiRateLimitHeaders;
}

export async function authenticateAPIKey(request: NextRequest): Promise<APIKeyAuthResult> {
  const adminClient = createAdminClient();

  const apiKey = request.headers.get('x-api-key');
  const apiSecret = request.headers.get('x-api-secret');

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      errorCode: 'authentication_required',
      error: 'API key y secret son requeridos',
      status: 401,
    };
  }

  const { data: keyData, error } = await adminClient
    .from('api_keys')
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !keyData) {
    return { success: false, errorCode: 'invalid_credentials', error: 'API key invalida', status: 401 };
  }

  const expectedSecret = keyData.api_secret_hash || keyData.api_secret;
  const isLegacyPlaintext = !keyData.api_secret_hash;

  if (!expectedSecret || !verifyApiSecret(apiSecret, expectedSecret, isLegacyPlaintext)) {
    return { success: false, errorCode: 'invalid_credentials', error: 'API secret incorrecto', status: 401 };
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return { success: false, errorCode: 'invalid_credentials', error: 'API key expirada', status: 401 };
  }

  const rateLimit = await consumeRateLimit({
    apiKeyId: keyData.id,
    rateLimit: Number(keyData.rate_limit || 100),
    windowMinutes: Number(keyData.rate_limit_window_minutes || 60),
  });

  if (!rateLimit.allowed) {
    return {
      success: false,
      errorCode: 'rate_limit_exceeded',
      error: `Rate limit excedido. Intenta de nuevo despues de ${rateLimit.retryAfterSeconds} segundos`,
      status: 429,
      rateLimit,
    };
  }

  await adminClient
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyData.id);

  return {
    success: true,
    apiKey: {
      id: keyData.id,
      app_name: keyData.app_name,
      user_id: keyData.user_id,
      environment: normalizeApiEnvironment(keyData.environment),
      role_access: keyData.role_access,
      permissions: keyData.permissions,
      rate_limit: keyData.rate_limit,
    },
    rateLimit,
  };
}

async function consumeRateLimit({
  apiKeyId,
  rateLimit,
  windowMinutes,
}: {
  apiKeyId: string;
  rateLimit: number;
  windowMinutes: number;
}): Promise<PublicApiRateLimitHeaders & { allowed: boolean }> {
  const adminClient = createAdminClient();
  const windowMs = Math.max(windowMinutes, 1) * 60 * 1000;
  const now = Date.now();
  const windowStartedAtMs = Math.floor(now / windowMs) * windowMs;
  const windowStartedAt = new Date(windowStartedAtMs).toISOString();
  const resetAt = new Date(windowStartedAtMs + windowMs).toISOString();

  const { data, error } = await adminClient
    .from('api_key_usage_windows')
    .select('id, request_count')
    .eq('api_key_id', apiKeyId)
    .eq('window_started_at', windowStartedAt)
    .maybeSingle();

  if (error) {
    throw new Error(`Rate limit lookup failed: ${error.message}`);
  }

  const currentCount = Number(data?.request_count || 0);
  if (currentCount >= rateLimit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartedAtMs + windowMs - now) / 1000));
    return {
      allowed: false,
      limit: rateLimit,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  const nextCount = currentCount + 1;
  const write = data
    ? adminClient
        .from('api_key_usage_windows')
        .update({ request_count: nextCount, updated_at: new Date().toISOString() })
        .eq('id', data.id)
    : adminClient.from('api_key_usage_windows').insert({
        api_key_id: apiKeyId,
        window_started_at: windowStartedAt,
        request_count: nextCount,
      });

  const { error: writeError } = await write;
  if (writeError) {
    throw new Error(`Rate limit persist failed: ${writeError.message}`);
  }

  return {
    allowed: true,
    limit: rateLimit,
    remaining: Math.max(rateLimit - nextCount, 0),
    resetAt,
  };
}

export async function requirePermission(
  auth: APIKeyAuthResult,
  permission: 'balance' | 'transfer' | 'history' | 'properties' | 'payments'
): Promise<boolean> {
  if (!auth.success || !auth.apiKey) {
    return false;
  }

  const permissions = auth.apiKey.permissions as Record<string, boolean>;
  return permissions[permission] === true;
}
