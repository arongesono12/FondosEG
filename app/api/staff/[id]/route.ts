import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSuperAdmin } from '@/lib/server/authz';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireProfile();
    requireSuperAdmin(profile);

    const { id } = await context.params;
    const body = (await request.json()) as { is_active?: boolean };

    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ success: false, error: 'is_active requerido' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, role, is_active, email')
      .eq('id', id)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ success: false, error: 'Administrador no encontrado' }, { status: 404 });
    }

    if (target.role === 'superadmin') {
      return NextResponse.json({ success: false, error: 'No se puede desactivar ni editar otro superadministrador desde esta pantalla' }, { status: 403 });
    }

    const { error } = await adminClient
      .from('users')
      .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await adminClient.from('activity_logs').insert({
      user_id: profile.id,
      action: 'toggle_admin_status',
      entity_type: 'user',
      entity_id: id,
      metadata: {
        target_user_id: id,
        target_email: target.email,
        is_active: body.is_active,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/staff/[id]]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
