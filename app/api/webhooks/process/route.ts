import { NextRequest, NextResponse } from 'next/server';
import { processWebhookDeliveries } from '@/lib/server/webhook-outbox';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_WORKER_SECRET;
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

    const stats = await processWebhookDeliveries(limit);
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Webhook process Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
