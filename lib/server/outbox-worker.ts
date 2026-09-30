import { after } from 'next/server';
import { processNotificationOutbox } from '@/lib/server/notification-outbox';
import { processWebhookDeliveries } from '@/lib/server/webhook-outbox';

/**
 * Worker de las colas de salida (SMS en `notification_outbox`, webhooks en
 * `webhook_deliveries`).
 *
 * Las operaciones sólo ESCRIBEN en esas tablas y responden. La entrega ocurre
 * por dos vías que se complementan:
 *
 *  1. `scheduleOutboxProcessing()` — tras enviar la respuesta (`after` de
 *     Next.js), para que en el caso normal el SMS salga en segundos.
 *  2. `/api/outbox/process` — invocado periódicamente (cron), que recoge lo que
 *     la vía 1 no llegó a entregar: reintentos, procesos que terminaron antes o
 *     proveedores caídos.
 *
 * Las dos pueden coincidir: los trabajos se reclaman con FOR UPDATE SKIP
 * LOCKED, así que nunca procesan la misma fila.
 */

export interface OutboxWorkerResult {
  notifications: { processed: number; sent: number; failed: number; retried: number } | { error: string };
  webhooks: { processed: number; sent: number; failed: number; retried: number } | { error: string };
}

export async function runOutboxWorker(limits: { notifications?: number; webhooks?: number } = {}): Promise<OutboxWorkerResult> {
  // Una cola caída no debe impedir que la otra avance.
  const [notifications, webhooks] = await Promise.allSettled([
    processNotificationOutbox(limits.notifications ?? 20),
    processWebhookDeliveries(limits.webhooks ?? 20),
  ]);

  return {
    notifications: notifications.status === 'fulfilled' ? notifications.value : { error: errorMessage(notifications.reason) },
    webhooks: webhooks.status === 'fulfilled' ? webhooks.value : { error: errorMessage(webhooks.reason) },
  };
}

/**
 * Programa una pasada del worker después de responder. No bloquea la
 * respuesta y nunca lanza: si falla, o si se llama fuera de una petición, el
 * trabajo sigue en la cola para el cron.
 */
export function scheduleOutboxProcessing(): void {
  try {
    after(async () => {
      const result = await runOutboxWorker({ notifications: 10, webhooks: 10 });
      if ('error' in result.notifications || 'error' in result.webhooks) {
        console.error('[outbox] background pass failed; the cron worker will retry', result);
      }
    });
  } catch (error) {
    console.warn('[outbox] could not schedule background processing; left for the cron worker', error);
  }
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
