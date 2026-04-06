import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile } from '@/lib/server/authz';
import { ADMIN_ROLES } from '@/lib/roles';

export async function GET() {
  try {
    await requireProfile();
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('users')
      .select('id, name, email, avatar_url, role')
      .in('role', ADMIN_ROLES)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[GET /api/admins]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

