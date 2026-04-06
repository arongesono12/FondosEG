import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';

export interface APIKeyAuthResult {
  success: boolean;
  apiKey?: {
    id: string;
    app_name: string;
    user_id: string;
    role_access: string;
    permissions: {
      balance: boolean;
      transfer: boolean;
      history: boolean;
    };
    rate_limit: number;
  };
  error?: string;
}

export async function authenticateAPIKey(request: NextRequest): Promise<APIKeyAuthResult> {
  const adminClient = createAdminClient();

  const apiKey = request.headers.get('x-api-key');
  const apiSecret = request.headers.get('x-api-secret');

  if (!apiKey || !apiSecret) {
    return { success: false, error: 'API key y secret son requeridos' };
  }

  const { data: keyData, error } = await adminClient
    .from('api_keys')
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !keyData) {
    return { success: false, error: 'API key inválida' };
  }

  if (keyData.api_secret !== apiSecret) {
    return { success: false, error: 'API secret incorrecto' };
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return { success: false, error: 'API key expirada' };
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
      role_access: keyData.role_access,
      permissions: keyData.permissions,
      rate_limit: keyData.rate_limit,
    },
  };
}

export async function requirePermission(
  auth: APIKeyAuthResult,
  permission: 'balance' | 'transfer' | 'history'
): Promise<boolean> {
  if (!auth.success || !auth.apiKey) {
    return false;
  }

  const permissions = auth.apiKey.permissions as Record<string, boolean>;
  return permissions[permission] === true;
}
