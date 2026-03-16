import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

type Kind = 'agent' | 'client' | 'admin';

function defaultKind(role: string): Kind {
  if (role === 'admin') return 'admin';
  if (role === 'cliente') return 'client';
  return 'agent';
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const kind = ((searchParams.get('kind') || defaultKind(profile.role)) as Kind) || defaultKind(profile.role);

    if (kind === 'admin') {
      requireRole(profile, 'admin');
      const { count, error } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin_notification', true)
        .eq('is_read', false);
      if (error) throw error;
      return NextResponse.json({ count: count || 0 });
    }

    if (kind === 'client') {
      const { count, error } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      if (error) throw error;
      return NextResponse.json({ count: count || 0 });
    }

    // agent
    const { data: transfers } = await adminClient.from('transfers').select('id').eq('agent_id', profile.id);
    const transferIds = (transfers || []).map((t: any) => t.id);
    if (transferIds.length === 0) return NextResponse.json({ count: 0 });

    const { count, error } = await adminClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .in('transfer_id', transferIds)
      .eq('is_read', false);

    if (error) throw error;
    return NextResponse.json({ count: count || 0 });
  } catch (err) {
    console.error('[GET /api/me/notifications/unread-count]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

