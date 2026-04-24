import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireAuthUser } from '@/lib/server/authz';
import { generateApiKey, generateApiSecret, getApiSecretPreview, hashApiSecret } from '@/lib/server/api-security';
import { isTransientNetworkError } from '@/lib/network-errors';
import { isAdminRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiPermission, UserRole } from '@/types';

const apiKeySelect = [
  'id',
  'app_name',
  'app_description',
  'api_key',
  'api_secret_preview',
  'role_access',
  'permissions',
  'is_active',
  'rate_limit',
  'rate_limit_window_minutes',
  'last_used_at',
  'expires_at',
  'created_at',
].join(',');

const permissionKeys: ApiPermission[] = ['balance', 'transfer', 'history'];

async function withSupabaseRetry<T>(operation: () => Promise<T>, attempts: number = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (isTransientNetworkError(error) && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

function normalizePermissions(input: unknown, role: UserRole) {
  const values = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  return permissionKeys.reduce<Record<ApiPermission, boolean>>((acc, key) => {
    const defaultValue = key === 'transfer' ? role === 'gestor' || role === 'cliente' : true;
    acc[key] = typeof values[key] === 'boolean' ? Boolean(values[key]) : defaultValue;
    return acc;
  }, { balance: true, transfer: false, history: true });
}

function publicApiKeyRecord(row: Record<string, unknown>) {
  return {
    id: row.id,
    app_name: row.app_name,
    app_description: row.app_description,
    api_key: row.api_key,
    api_secret_preview: row.api_secret_preview,
    role_access: row.role_access,
    permissions: row.permissions,
    is_active: row.is_active,
    rate_limit: row.rate_limit,
    rate_limit_window_minutes: row.rate_limit_window_minutes,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    const adminClient = createAdminClient();
    
    const { data: apiKeys, error } = await withSupabaseRetry(() =>
      adminClient
        .from('api_keys')
        .select(apiKeySelect)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(apiKeys || []);

  } catch (error) {
    console.error('API Keys GET Error:', error);
    if (isTransientNetworkError(error)) {
      return NextResponse.json(
        { error: 'No se pudo conectar con Supabase para consultar las credenciales. Intenta de nuevo en unos segundos.' },
        { status: 503 }
      );
    }
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser();

    const body = await request.json();
    const { app_name, app_description, role_access = 'cliente', permissions } = body;

    if (!app_name) {
      return NextResponse.json(
        { error: 'El nombre de la app es requerido' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: profile, error: profileError } = await withSupabaseRetry(() =>
      adminClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
    );

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'No se pudo validar el perfil del usuario' },
        { status: 401 }
      );
    }

    const requestedRole = String(role_access) as UserRole;
    const allowedRoles: UserRole[] = isAdminRole(profile.role)
      ? ['admin', 'superadmin', 'gestor', 'cliente']
      : [profile.role as UserRole];

    if (!allowedRoles.includes(requestedRole)) {
      return NextResponse.json(
        { error: 'No puedes emitir credenciales para ese rol' },
        { status: 403 }
      );
    }

    const keyData = generateApiKey();
    const secretData = generateApiSecret();
    const secretHash = hashApiSecret(secretData);

    const { data: apiKey, error: insertError } = await withSupabaseRetry(() =>
      adminClient
        .from('api_keys')
        .insert({
          app_name,
          app_description,
          api_key: keyData,
          api_secret: secretHash,
          api_secret_hash: secretHash,
          api_secret_preview: getApiSecretPreview(secretData),
          user_id: user.id,
          role_access: requestedRole,
          permissions: normalizePermissions(permissions, requestedRole),
        })
        .select(apiKeySelect)
        .single()
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      apiKey: {
        ...publicApiKeyRecord(apiKey as unknown as Record<string, unknown>),
        api_key: keyData,
        api_secret: secretData,
      },
    });

  } catch (error) {
    console.error('API Keys POST Error:', error);
    if (isTransientNetworkError(error)) {
      return NextResponse.json(
        { error: 'No se pudo conectar con Supabase para crear la credencial. Intenta de nuevo en unos segundos.' },
        { status: 503 }
      );
    }
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthUser();

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        { error: 'ID de API key requerido' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    
    const { error } = await withSupabaseRetry(() =>
      adminClient
        .from('api_keys')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', keyId)
        .eq('user_id', user.id)
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('API Keys DELETE Error:', error);
    if (isTransientNetworkError(error)) {
      return NextResponse.json(
        { error: 'No se pudo conectar con Supabase para revocar la credencial. Intenta de nuevo en unos segundos.' },
        { status: 503 }
      );
    }
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

