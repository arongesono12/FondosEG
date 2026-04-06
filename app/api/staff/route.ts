import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSuperAdmin } from '@/lib/server/authz';
import { ADMIN_ROLES } from '@/lib/roles';
import type { UserRole } from '@/types';

export async function GET() {
  try {
    const profile = await requireProfile();
    requireSuperAdmin(profile);

    const adminClient = createAdminClient();
    const { data: staff, error } = await adminClient
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at')
      .in('role', ADMIN_ROLES)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffIds = (staff || []).map((member) => member.id);
    const { data: activity } = staffIds.length
      ? await adminClient
          .from('activity_logs')
          .select('user_id, action, created_at')
          .in('user_id', staffIds)
          .order('created_at', { ascending: false })
          .limit(500)
      : { data: [], error: null };

    const activitySummary = new Map<string, { count: number; lastActionAt?: string; lastAction?: string }>();
    for (const log of activity || []) {
      const current = activitySummary.get(log.user_id) || { count: 0 };
      current.count += 1;
      if (!current.lastActionAt || new Date(log.created_at) > new Date(current.lastActionAt)) {
        current.lastActionAt = log.created_at;
        current.lastAction = log.action;
      }
      activitySummary.set(log.user_id, current);
    }

    return NextResponse.json(
      (staff || []).map((member) => ({
        ...member,
        action_count: activitySummary.get(member.id)?.count || 0,
        last_action_at: activitySummary.get(member.id)?.lastActionAt || null,
        last_action: activitySummary.get(member.id)?.lastAction || null,
      }))
    );
  } catch (err) {
    console.error('[GET /api/staff]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireSuperAdmin(profile);

    const body = (await request.json()) as {
      name: string;
      email: string;
      phone: string;
      password: string;
      country?: string;
      city?: string;
      role?: UserRole;
    };

    if (!body.name || !body.email || !body.phone || !body.password) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const role: UserRole = body.role === 'superadmin' ? 'admin' : 'admin';

    const { data: authData, error } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        name: body.name,
        phone: body.phone,
        role,
        country: body.country,
        city: body.city,
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await adminClient.from('users').update({ is_verified: true }).eq('id', authData.user?.id ?? '');

    await adminClient.from('activity_logs').insert({
      user_id: profile.id,
      action: 'create_admin',
      entity_type: 'user',
      entity_id: authData.user?.id ?? null,
      metadata: {
        created_role: role,
        email: body.email,
      },
    });

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err) {
    console.error('[POST /api/staff]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
