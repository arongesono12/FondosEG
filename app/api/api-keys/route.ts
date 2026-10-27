import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, requireDeveloperAccess } from '@/lib/server/authz';
import { normalizeApiEnvironment } from '@/lib/server/api-environments';
import { generateApiKey, generateApiSecret, getApiSecretPreview, hashApiSecret } from '@/lib/server/api-security';
import { isTransientNetworkError } from '@/lib/network-errors';
import {
  buildCredentialScopeFilter,
  CredentialOwnerError,
  credentialRouteError,
  requireVisibleApplication,
} from '@/lib/server/credential-ownership';
import {
  canIssueProductionCredentials,
  isUuid,
  normalizeCredentialPermissions,
} from '@/lib/server/credential-ownership-rules';
import { createAdminClient } from '@/lib/supabase/admin';

const apiKeySelect = [
  'id',
  'application_id',
  'app_name',
  'app_description',
  'api_key',
  'environment',
  'api_secret_preview',
  'permissions',
  'is_active',
  'rate_limit',
  'rate_limit_window_minutes',
  'last_used_at',
  'expires_at',
  'created_at',
].join(',');

/**
 * Una credencial se emite PARA UNA APLICACIÓN. Opera la billetera de la
 * aplicación, así que no hay rol que elegir ni teléfono que indicar.
 */
const createApiKeySchema = z.object({
  application_id: z.string().trim().min(1, 'Selecciona una aplicación'),
  environment: z.enum(['test', 'production']).default('test'),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

async function withSupabaseRetry<T>(operation: () => PromiseLike<T>, attempts: number = 3): Promise<Awaited<T>> {
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

function publicApiKeyRecord(row: Record<string, unknown>) {
  return {
    id: row.id,
    application_id: row.application_id ?? null,
    app_name: row.app_name,
    app_description: row.app_description,
    api_key: row.api_key,
    environment: normalizeApiEnvironment(row.environment),
    api_secret_preview: row.api_secret_preview,
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
    const access = await requireDeveloperAccess();
    const scopeFilter = await buildCredentialScopeFilter(user.id, access.access_role);

    const { data: apiKeys, error } = await withSupabaseRetry(() =>
      createAdminClient()
        .from('api_keys')
        .select(apiKeySelect)
        .or(scopeFilter)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    );

    if (error) throw new Error(error.message);

    return NextResponse.json(((apiKeys || []) as unknown as Array<Record<string, unknown>>).map(publicApiKeyRecord));
  } catch (error) {
    return credentialRouteError(error, 'API Keys GET');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const parsed = createApiKeySchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Revisa los datos de la credencial', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { environment, permissions } = parsed.data;
    if (environment === 'production' && !canIssueProductionCredentials(access.access_role)) {
      throw new CredentialOwnerError('Solo administración puede emitir credenciales de producción', 403);
    }

    const application = await requireVisibleApplication(parsed.data.application_id, user.id, access.access_role);
    const keyData = generateApiKey(environment);
    const secretData = generateApiSecret();
    const secretHash = hashApiSecret(secretData);

    const { data: apiKey, error: insertError } = await withSupabaseRetry(() =>
      createAdminClient()
        .from('api_keys')
        .insert({
          application_id: application.id,
          app_name: application.name,
          app_description: application.description,
          api_key: keyData,
          api_secret: secretHash,
          api_secret_hash: secretHash,
          api_secret_preview: getApiSecretPreview(secretData),
          environment,
          // Titular: la billetera de la aplicación. `role_access` es interno:
          // las billeteras de aplicación son de cliente.
          user_id: application.wallet_user_id,
          issued_by_user_id: user.id,
          role_access: 'cliente',
          permissions: normalizeCredentialPermissions(permissions),
        })
        .select(apiKeySelect)
        .single()
    );

    if (insertError || !apiKey) throw new Error(insertError?.message || 'No se pudo crear la credencial');

    return NextResponse.json({
      success: true,
      apiKey: {
        ...publicApiKeyRecord(apiKey as unknown as Record<string, unknown>),
        api_key: keyData,
        api_secret: secretData,
      },
    });
  } catch (error) {
    return credentialRouteError(error, 'API Keys POST');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const keyId = new URL(request.url).searchParams.get('id');

    if (!isUuid(keyId)) {
      return NextResponse.json({ error: 'ID de API key requerido' }, { status: 400 });
    }

    const scopeFilter = await buildCredentialScopeFilter(user.id, access.access_role);
    const { error } = await withSupabaseRetry(() =>
      createAdminClient()
        .from('api_keys')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', keyId)
        .or(scopeFilter)
    );

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return credentialRouteError(error, 'API Keys DELETE');
  }
}
