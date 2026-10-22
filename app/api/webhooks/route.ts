import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthzError, requireAuthUser, requireDeveloperAccess } from '@/lib/server/authz';
import {
  attachOwnerLabels,
  buildOwnedOrIssuedFilter,
  CredentialOwnerError,
  resolveCredentialOwner,
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

const createWebhookSchema = z.object({
  name: z.string().trim().min(1, 'name es requerido'),
  description: z.string().trim().optional(),
  target_url: z.string().url('target_url debe ser una URL valida'),
  event_types: z.array(z.enum(eventTypes)).min(1, 'Selecciona al menos un evento'),
  /** Billetera cliente titular; solo el superadmin. Vacío = webhook propio. */
  owner_phone: z.string().trim().max(32).optional(),
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
  'user_id',
  'issued_by_user_id',
].join(',');

export async function GET() {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('webhook_subscriptions')
      .select(subscriptionSelect)
      .or(buildOwnedOrIssuedFilter(user.id, access.access_role))
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(await attachOwnerLabels((data || []) as unknown as Array<Record<string, unknown>>));
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
    const access = await requireDeveloperAccess();
    const payload = createWebhookSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: 'Payload invalido', details: payload.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Sin la clave no se puede cifrar el secreto de firma. Se comprueba antes
    // de tocar la base de datos para no dejar una suscripción a medias.
    if (!isWebhookEncryptionConfigured()) {
      console.error('POST /api/webhooks: WEBHOOK_ENCRYPTION_KEY ausente o inválida');
      return NextResponse.json({ error: WEBHOOK_ENCRYPTION_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }

    // El webhook pertenece a la billetera cuyos eventos recibe: los eventos de
    // solicitudes de cobro solo se entregan a las suscripciones del comercio.
    const owner = await resolveCredentialOwner({
      actorUserId: user.id,
      actorAccessRole: access.access_role,
      ownerPhone: payload.data.owner_phone,
      requestedRole: null,
    });

    const adminClient = createAdminClient();
    const secret = generateWebhookSigningSecret();

    const { data, error } = await adminClient
      .from('webhook_subscriptions')
      .insert({
        user_id: owner.ownerUserId,
        issued_by_user_id: owner.issuedByUserId,
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

    const [labelled] = await attachOwnerLabels([data as unknown as Record<string, unknown>]);

    return NextResponse.json({
      success: true,
      subscription: {
        ...labelled,
        signing_secret: secret,
      },
    });
  } catch (error) {
    if (error instanceof CredentialOwnerError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Webhook subscriptions POST Error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
