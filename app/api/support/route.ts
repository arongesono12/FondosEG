import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

import { queueNotification, processNotificationOutbox } from '@/lib/server/notification-outbox';

interface SupportMessageBody {
  message: string;
  targetAdminId?: string;
  targetAdminPhone?: string;
  requestType?: 'balance_topup' | 'report_error' | 'general' | string;
}

// Twilio and sendSMS replaced by lib/server/notification-outbox.ts

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const data: SupportMessageBody = await request.json();

    if (!data.message || !data.message.trim()) {
      return NextResponse.json({ error: 'El mensaje es requerido' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const requestType = data.requestType || null;

    const isClient = profile.role === 'cliente';
    const targetRole = isClient ? 'gestor' : 'admin';

    // Resolve and validate target (never trust client-provided phone/name/email).
    let targetUser: { id: string; name: string; phone: string; role: string } | null = null;

    if (data.targetAdminId) {
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('id, name, phone, role, is_active')
        .eq('id', data.targetAdminId)
        .single();
      if (userRow && userRow.is_active !== false && userRow.role === targetRole) {
        targetUser = { id: userRow.id, name: userRow.name, phone: userRow.phone, role: userRow.role };
      }
    } else if (data.targetAdminPhone) {
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('id, name, phone, role, is_active')
        .eq('phone', data.targetAdminPhone)
        .single();
      if (userRow && userRow.is_active !== false && userRow.role === targetRole) {
        targetUser = { id: userRow.id, name: userRow.name, phone: userRow.phone, role: userRow.role };
      }
    }

    if (isClient) {
      // Clients may only contact gestors who have completed transfers to them.
      const { data: transfers } = await supabaseAdmin
        .from('transfers')
        .select('agent_id')
        .eq('sender_id', profile.id)
        .in('status', ['completed', 'paid_out']);
      const allowedAgentIds = new Set((transfers || []).map((t: { agent_id: string }) => t.agent_id).filter(Boolean));
      if (!targetUser || !allowedAgentIds.has(targetUser.id)) {
        return NextResponse.json({ error: 'Gestor no autorizado' }, { status: 403 });
      }
    } else {
      // Non-clients may only contact admins.
      if (!targetUser) {
        return NextResponse.json({ error: 'Administrador no válido' }, { status: 400 });
      }
    }

    const { error } = await supabaseAdmin.from('support_messages').insert({
      user_id: profile.id,
      user_name: profile.name || 'Usuario anónimo',
      user_email: profile.email || null,
      message: data.message,
      status: 'pending',
      request_type: requestType,
    });

    if (error) {
      console.error('Error saving support message:', error);
      return NextResponse.json({ error: 'Error al guardar el mensaje' }, { status: 500 });
    }

    if (requestType === 'balance_topup') {
      const typeLabel = 'SOLICITUD DE RECARGA';
      const adminMessage = `FondosEG - ${typeLabel}\n\nDe: ${profile.name}\n\nMensaje:\n${data.message}\n\nEste mensaje fue enviado desde la app.`;

      if (targetUser?.phone) {
        try {
          await queueNotification({
            userId: targetUser.id,
            phone: targetUser.phone,
            message: adminMessage,
            priority: 'high',
          });
          await processNotificationOutbox(5);
        } catch (notifErr) {
          console.error('Failed to queue/process support SMS:', notifErr);
        }
      }

      await supabaseAdmin.from('notifications').insert({
        message: `${profile.name} ha solicitado una recarga de saldo.\n\nMensaje: ${data.message}`,
        status: 'pending',
        is_admin_notification: true,
        priority: 'high',
        user_id: profile.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Support API error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

