import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const { id } = await context.params;
    const body = (await request.json()) as { is_active: boolean };
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ success: false, error: 'is_active requerido' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('users').update({ is_active: body.is_active }).eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/agents/[id]/status]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
