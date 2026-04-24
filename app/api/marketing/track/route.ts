import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

const allowedActions = new Set([
  'landing_audience_select',
  'landing_cta_click',
  'landing_form_submit',
]);

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = safeText(body.action, 80);

    if (!action || !allowedActions.has(action)) {
      return NextResponse.json({ success: false, error: 'Invalid marketing action' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent');

    const metadata = {
      audience: safeText(body.audience, 40),
      cta: safeText(body.cta, 120),
      target: safeText(body.target, 200),
      section: safeText(body.section, 80),
      theme: safeText(body.theme, 20),
      pathname: safeText(body.pathname, 120),
      session_id: safeText(body.session_id, 120),
      selected_audience: safeText(body.selected_audience, 40),
    };

    await adminClient.from('activity_logs').insert({
      user_id: null,
      action,
      entity_type: 'marketing_landing',
      entity_id: null,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error('[POST /api/marketing/track]', error);
    return NextResponse.json({ success: true }, { status: 202 });
  }
}
