import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

type Kind = 'agent' | 'client' | 'admin';

function defaultKind(role: string): Kind {
  if (role === 'admin') return 'admin';
  if (role === 'cliente') return 'client';
  return 'agent';
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();
    const body = (await request.json().catch(() => ({}))) as { kind?: Kind };
    const kind = body.kind || defaultKind(profile.role);

    const nowIso = new Date().toISOString();

    if (kind === 'admin') {
      requireRole(profile, 'admin');
      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true, read_at: nowIso })
        .eq('is_admin_notification', true)
        .eq('is_read', false);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (kind === 'client') {
      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true, read_at: nowIso })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    const { data: transfers, error: transfersError } = await adminClient
      .from('transfers')
      .select('id')
      .eq('agent_id', profile.id);
    if (transfersError) throw transfersError;

    const transferIds = (transfers || []).map((t: any) => t.id);
    if (transferIds.length === 0) return NextResponse.json({ success: true });

    const { error } = await adminClient
      .from('notifications')
      .update({ is_read: true, read_at: nowIso })
      .in('transfer_id', transferIds)
      .eq('is_read', false);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/me/notifications/read-all]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

