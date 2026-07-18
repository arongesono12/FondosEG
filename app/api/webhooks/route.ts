import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthzError, requireAuthUser, requireDeveloperAccess } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  encryptWebhookSecret,
  generateWebhookSigningSecret,
  getWebhookSecretPreview,
} from '@/lib/server/webhook-security';

const eventTypes = ['transfer.created', 'transfer.paid_out', 'wallet_transfer.confirmed'] as const;

const createWebhookSchema = z.object({
  name: z.string().trim().min(1, 'name es requerido'),
  description: z.string().trim().optional(),
  target_url: z.string().url('target_url debe ser una URL valida'),
  event_types: z.array(z.enum(eventTypes)).min(1, 'Selecciona al menos un evento'),
});

const subscriptionSelect = [
  'id',
  'name',
  'description',
  'target_url',
  'event_types',
  'signing_secret_preview',
  'status',
  'last_delivery_at',
  'created_at',
  'updated_at',
].join(',');

export async function GET() {
  try {
    const user = await requireAuthUser();
    await requireDeveloperAccess();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('webhook_subscriptions')
      .select(subscriptionSelect)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Webhook subscriptions GET Error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser();
    await requireDeveloperAccess();
    const payload = createWebhookSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: 'Payload invalido', details: payload.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const secret = generateWebhookSigningSecret();

    const { data, error } = await adminClient
      .from('webhook_subscriptions')
      .insert({
        user_id: user.id,
        name: payload.data.name,
        description: payload.data.description ?? null,
        target_url: payload.data.target_url,
        event_types: payload.data.event_types,
        signing_secret_encrypted: encryptWebhookSecret(secret),
        signing_secret_preview: getWebhookSecretPreview(secret),
      })
      .select(subscriptionSelect)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'No se pudo crear el webhook' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        ...(data as unknown as Record<string, unknown>),
        signing_secret: secret,
      },
    });
  } catch (error) {
    console.error('Webhook subscriptions POST Error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
