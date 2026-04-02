import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();
    const body = (await request.json()) as { id: string };

    if (!body?.id) {
      return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
    }

    // Authorization: admin can update any; client only own; gestor only for their transfers.
    if (profile.role === 'cliente') {
      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', body.id)
        .eq('user_id', profile.id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (profile.role === 'gestor') {
      const { data: n } = await adminClient.from('notifications').select('transfer_id').eq('id', body.id).single();
      if (!n?.transfer_id) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

      const { data: t } = await adminClient.from('transfers').select('agent_id').eq('id', n.transfer_id).single();
      if (!t || t.agent_id !== profile.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', body.id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    const { error } = await adminClient
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', body.id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err, 'POST /api/me/notifications/read', { mutation: true });
  }
}
