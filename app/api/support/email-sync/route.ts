import { NextRequest, NextResponse } from 'next/server';

import { syncSupportInbox } from '@/lib/server/support-email-sync';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.SUPPORT_EMAIL_SYNC_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get('authorization') || '';
  return authorization === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit =
      typeof body?.limit === 'number' && Number.isFinite(body.limit)
        ? Math.min(Math.max(body.limit, 1), 100)
        : 20;

    const stats = await syncSupportInbox(limit);
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('[POST /api/support/email-sync]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
