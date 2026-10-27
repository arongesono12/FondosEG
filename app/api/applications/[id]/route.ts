import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, requireDeveloperAccess } from '@/lib/server/authz';
import { credentialRouteError, requireVisibleApplication } from '@/lib/server/credential-ownership';
import { createAdminClient } from '@/lib/supabase/admin';

const updateApplicationSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
}).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const { id } = await context.params;
    const application = await requireVisibleApplication(id, user.id, access.access_role);
    const parsed = updateApplicationSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Revisa los datos de la aplicación', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await adminClient
      .from('api_applications')
      .update({ ...parsed.data, updated_at: now })
      .eq('id', application.id);

    if (error) throw new Error(error.message);

    // Las credenciales repiten el nombre para los logs, y la billetera propia
    // lo muestra a los clientes en los cobros y en los recibos.
    if (parsed.data.name) {
      const { error: keysError } = await adminClient
        .from('api_keys')
        .update({ app_name: parsed.data.name, updated_at: now })
        .eq('application_id', application.id);
      if (keysError) throw new Error(keysError.message);

      if (application.has_dedicated_wallet) {
        const { error: walletError } = await adminClient
          .from('users')
          .update({ name: parsed.data.name, updated_at: now })
          .eq('id', application.wallet_user_id);
        if (walletError) throw new Error(walletError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return credentialRouteError(error, 'Application PATCH');
  }
}

/**
 * Archiva la aplicación: revoca sus credenciales y desactiva sus webhooks. La
 * billetera y su saldo se conservan; nada se borra.
 */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const { id } = await context.params;
    const application = await requireVisibleApplication(id, user.id, access.access_role);
    const adminClient = createAdminClient();
    const now = new Date().toISOString();

    const { error: keysError } = await adminClient
      .from('api_keys')
      .update({ is_active: false, updated_at: now })
      .eq('application_id', application.id);
    if (keysError) throw new Error(keysError.message);

    const { error: webhooksError } = await adminClient
      .from('webhook_subscriptions')
      .update({ status: 'disabled', updated_at: now })
      .eq('application_id', application.id);
    if (webhooksError) throw new Error(webhooksError.message);

    const { error } = await adminClient
      .from('api_applications')
      .update({ status: 'disabled', updated_at: now })
      .eq('id', application.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return credentialRouteError(error, 'Application DELETE');
  }
}
