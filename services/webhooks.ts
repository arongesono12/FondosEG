import type { SubscribableWebhookEvent } from '@/lib/server/webhook-events';
import { fetchJSON } from './http';

export interface WebhookSubscriptionRecord {
  id: string;
  application_id: string | null;
  name: string;
  description: string | null;
  target_url: string;
  event_types: SubscribableWebhookEvent[];
  signing_secret_preview: string;
  status: 'active' | 'paused' | 'disabled';
  last_delivery_at: string | null;
  created_at: string;
}

export interface CreateWebhookData {
  /** Aplicación cuyos eventos recibe el webhook. */
  application_id: string;
  name?: string;
  target_url: string;
  event_types: SubscribableWebhookEvent[];
}

export interface CreatedWebhookResponse {
  success: boolean;
  subscription: WebhookSubscriptionRecord & { signing_secret: string };
}

export async function getWebhookSubscriptions(): Promise<WebhookSubscriptionRecord[]> {
  return fetchJSON<WebhookSubscriptionRecord[]>('/api/webhooks');
}

export async function createWebhookSubscription(payload: CreateWebhookData): Promise<CreatedWebhookResponse> {
  return fetchJSON<CreatedWebhookResponse>('/api/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** La ruta desactiva la suscripción (status `disabled`); no la borra. */
export async function disableWebhookSubscription(id: string): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/api/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
