import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSuperAdmin } from '@/lib/server/authz';
import { ADMIN_ROLES } from '@/lib/roles';

export async function GET() {
  try {
    const profile = await requireProfile();
    requireSuperAdmin(profile);

    const adminClient = createAdminClient();
    const { data: staff, error: staffError } = await adminClient
      .from('users')
      .select('id, name, role')
      .in('role', ADMIN_ROLES);

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    }

    const staffIds = (staff || []).map((member) => member.id);
    if (staffIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: logs, error } = await adminClient
      .from('activity_logs')
      .select('id, user_id, action, entity_type, entity_id, metadata, created_at')
      .in('user_id', staffIds)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffMap = new Map((staff || []).map((member) => [member.id, member]));

    return NextResponse.json(
      (logs || []).map((log) => ({
        ...log,
        actor_name: staffMap.get(log.user_id)?.name || 'Desconocido',
        actor_role: staffMap.get(log.user_id)?.role || 'admin',
      }))
    );
  } catch (err) {
    console.error('[GET /api/staff/activity]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
