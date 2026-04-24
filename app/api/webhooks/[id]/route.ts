import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthzError, requireAuthUser } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';

const eventTypes = ['transfer.created', 'transfer.paid_out', 'wallet_transfer.confirmed'] as const;

const updateWebhookSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  target_url: z.string().url('target_url debe ser una URL valida').optional(),
  event_types: z.array(z.enum(eventTypes)).min(1, 'Selecciona al menos un evento').optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const payload = updateWebhookSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: 'Payload invalido', details: payload.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updatePayload = {
      ...payload.data,
      updated_at: new Date().toISOString(),
    };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('webhook_subscriptions')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(subscriptionSelect)
      .single();

    if (error || !data) {
      const status = error?.code === 'PGRST116' ? 404 : 500;
      return NextResponse.json(
        { error: error?.message || 'No se pudo actualizar el webhook' },
        { status }
      );
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    console.error('Webhook subscription PATCH Error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('webhook_subscriptions')
      .update({
        status: 'disabled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select(subscriptionSelect)
      .single();

    if (error || !data) {
      const status = error?.code === 'PGRST116' ? 404 : 500;
      return NextResponse.json(
        { error: error?.message || 'No se pudo desactivar el webhook' },
        { status }
      );
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    console.error('Webhook subscription DELETE Error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
