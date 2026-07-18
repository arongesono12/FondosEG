import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireAuthUser, requireDeveloperAccess } from '@/lib/server/authz';
import { normalizeApiEnvironment } from '@/lib/server/api-environments';
import { generateApiSecret, getApiSecretPreview, hashApiSecret } from '@/lib/server/api-security';
import { createAdminClient } from '@/lib/supabase/admin';

const apiKeySelect = [
  'id',
  'app_name',
  'app_description',
  'api_key',
  'environment',
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    await requireDeveloperAccess();
    const { id } = await params;
    const adminClient = createAdminClient();

    const secret = generateApiSecret();
    const secretHash = hashApiSecret(secret);
    const secretPreview = getApiSecretPreview(secret);

    const { data: rotated, error } = await adminClient.rpc('rotate_api_secret_operation', {
      p_api_key_id: id,
      p_user_id: user.id,
      p_api_secret_hash: secretHash,
      p_api_secret_preview: secretPreview,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rotated) {
      return NextResponse.json({ error: 'API key no encontrada' }, { status: 404 });
    }

    const { data: apiKey, error: keyError } = await adminClient
      .from('api_keys')
      .select(apiKeySelect)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (keyError || !apiKey) {
      return NextResponse.json({ error: 'API key no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      apiKey: {
        ...(apiKey as unknown as Record<string, unknown>),
        environment: normalizeApiEnvironment((apiKey as { environment?: unknown }).environment),
        api_secret: secret,
      },
    });
  } catch (error) {
    console.error('API Keys Rotate Error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
