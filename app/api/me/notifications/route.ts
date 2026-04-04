import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireRole } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';

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
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    if (kind === 'admin') {
      requireRole(profile, 'admin');
      const { data, error } = await adminClient
        .from('notifications')
        .select('*')
        .eq('is_admin_notification', true)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (kind === 'client') {
      const { data, error } = await adminClient
        .from('notifications')
        .select(
          `
          *,
          transfer:transfers!notifications_transfer_id_fkey (
            transfer_code,
            sender_name,
            receiver_name,
            receiver_phone,
            amount,
            currency,
            destination_city,
            created_at
          )
        `
        )
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // agent (gestor): notifications linked to transfers where agent_id = profile.id
    const { data, error } = await adminClient
      .from('notifications')
      .select(
        `
        *,
        transfer:transfers!notifications_transfer_id_fkey (
          transfer_code,
          sender_name,
          receiver_name,
          receiver_phone,
          amount,
          currency,
          destination_city,
          created_at,
          agent_id
        )
      `
      )
      .eq('transfer.agent_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return handleRouteError(err, 'GET /api/me/notifications');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
    }

    if (profile.role === 'admin') {
      const { error } = await adminClient.from('notifications').delete().eq('id', id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (profile.role === 'cliente') {
      const { error } = await adminClient.from('notifications').delete().eq('id', id).eq('user_id', profile.id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // gestor: ensure notification belongs to one of their transfers
    const { data: n, error: nError } = await adminClient.from('notifications').select('id, transfer_id').eq('id', id).single();
    if (nError || !n?.transfer_id) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const { data: t } = await adminClient.from('transfers').select('agent_id').eq('id', n.transfer_id).single();
    if (!t || t.agent_id !== profile.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await adminClient.from('notifications').delete().eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/me/notifications', { mutation: true });
  }
}
