import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, requireDeveloperAccess } from '@/lib/server/authz';
import {
  buildCredentialScopeFilter,
  credentialRouteError,
  requireVisibleApplication,
} from '@/lib/server/credential-ownership';
import { createAdminClient } from '@/lib/supabase/admin';
import { SUBSCRIBABLE_WEBHOOK_EVENTS } from '@/lib/server/webhook-events';
import {
  encryptWebhookSecret,
  generateWebhookSigningSecret,
  getWebhookSecretPreview,
  isWebhookEncryptionConfigured,
  WEBHOOK_ENCRYPTION_NOT_CONFIGURED_MESSAGE,
} from '@/lib/server/webhook-security';

const eventTypes = SUBSCRIBABLE_WEBHOOK_EVENTS;

/**
 * El webhook se registra para una aplicación y recibe los eventos de su
 * billetera: los cobros pagados o cancelados y los envíos que haga.
 */
const createWebhookSchema = z.object({
  application_id: z.string().trim().min(1, 'Selecciona una aplicación'),
  name: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  target_url: z.string().trim().url('target_url debe ser una URL valida'),
  event_types: z.array(z.enum(eventTypes)).min(1, 'Selecciona al menos un evento'),
});

const subscriptionSelect = [
  'id',
  'application_id',
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
    const access = await requireDeveloperAccess();

    const { data, error } = await createAdminClient()
      .from('webhook_subscriptions')
      .select(subscriptionSelect)
      .or(await buildCredentialScopeFilter(user.id, access.access_role))
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json(data || []);
  } catch (error) {
    return credentialRouteError(error, 'Webhook subscriptions GET');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const payload = createWebhookSchema.safeParse(await request.json().catch(() => null));

    if (!payload.success) {
      return NextResponse.json(
        { error: 'Revisa los datos del webhook', details: payload.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Sin la clave no se puede cifrar el secreto de firma. Se comprueba antes
    // de tocar la base de datos para no dejar una suscripción a medias.
    if (!isWebhookEncryptionConfigured()) {
      console.error('POST /api/webhooks: WEBHOOK_ENCRYPTION_KEY ausente o inválida');
      return NextResponse.json({ error: WEBHOOK_ENCRYPTION_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }

    const application = await requireVisibleApplication(payload.data.application_id, user.id, access.access_role);
    const secret = generateWebhookSigningSecret();

    const { data, error } = await createAdminClient()
      .from('webhook_subscriptions')
      .insert({
        // Los eventos se entregan a las suscripciones de la billetera que cobra.
        user_id: application.wallet_user_id,
        issued_by_user_id: user.id,
        application_id: application.id,
        name: payload.data.name || application.name,
        description: payload.data.description ?? null,
        target_url: payload.data.target_url,
        event_types: payload.data.event_types,
        signing_secret_encrypted: encryptWebhookSecret(secret),
        signing_secret_preview: getWebhookSecretPreview(secret),
      })
      .select(subscriptionSelect)
      .single();

    if (error || !data) throw new Error(error?.message || 'No se pudo crear el webhook');

    return NextResponse.json({
      success: true,
      subscription: {
        ...(data as unknown as Record<string, unknown>),
        signing_secret: secret,
      },
    });
  } catch (error) {
    return credentialRouteError(error, 'Webhook subscriptions POST');
  }
}
