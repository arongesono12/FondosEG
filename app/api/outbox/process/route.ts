import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runOutboxWorker } from '@/lib/server/outbox-worker';

/**
 * Worker de SMS y webhooks (ver lib/server/outbox-worker.ts).
 *
 * Debe invocarse periódicamente (cada minuto) con
 * `Authorization: Bearer <OUTBOX_WORKER_SECRET>`. Acepta también `CRON_SECRET`
 * (el que envía Vercel Cron) y `WEBHOOK_WORKER_SECRET` (el del antiguo
 * `/api/webhooks/process`), para no obligar a rotar secretos.
 *
 * Admite GET (Vercel Cron) y POST con `{ "limit": n }`.
 */

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const authorization = request.headers.get('authorization') ?? '';
  const secrets = [process.env.OUTBOX_WORKER_SECRET, process.env.CRON_SECRET, process.env.WEBHOOK_WORKER_SECRET]
    .filter((secret): secret is string => typeof secret === 'string' && secret.length >= 16);

  return secrets.some((secret) => {
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(authorization);
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}

async function handle(request: NextRequest, limit: number) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runOutboxWorker({ notifications: limit, webhooks: limit });
  const failed = 'error' in result.notifications || 'error' in result.webhooks;
  if (failed) console.error('[POST /api/outbox/process]', result);

  return NextResponse.json({ success: !failed, ...result }, { status: failed ? 500 : 200 });
}

export async function GET(request: NextRequest) {
  return handle(request, 20);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const limit =
    typeof body?.limit === 'number' && Number.isFinite(body.limit) ? Math.min(Math.max(Math.floor(body.limit), 1), 100) : 20;
  return handle(request, limit);
}
