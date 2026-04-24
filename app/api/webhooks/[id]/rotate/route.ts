import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireAuthUser } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  encryptWebhookSecret,
  generateWebhookSigningSecret,
  getWebhookSecretPreview,
} from '@/lib/server/webhook-security';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const adminClient = createAdminClient();
    const secret = generateWebhookSigningSecret();

    const { data, error } = await adminClient
      .from('webhook_subscriptions')
      .update({
        signing_secret_encrypted: encryptWebhookSecret(secret),
        signing_secret_preview: getWebhookSecretPreview(secret),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select(
        'id,name,description,target_url,event_types,signing_secret_preview,status,last_delivery_at,created_at,updated_at'
      )
      .single();

    if (error || !data) {
      const status = error?.code === 'PGRST116' ? 404 : 500;
      return NextResponse.json(
        { error: error?.message || 'No se pudo rotar el secreto del webhook' },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        ...(data as Record<string, unknown>),
        signing_secret: secret,
      },
    });
  } catch (error) {
    console.error('Webhook subscription rotate Error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
