'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Copy, Plus, Trash2 } from '@/components/ui/hugeicons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SUBSCRIBABLE_WEBHOOK_EVENTS,
  WEBHOOK_EVENT_DESCRIPTIONS,
  type SubscribableWebhookEvent,
} from '@/lib/server/webhook-events';
import {
  createWebhookSubscription,
  disableWebhookSubscription,
  getWebhookSubscriptions,
  type WebhookSubscriptionRecord,
} from '@/services/webhooks';

/**
 * Alta y baja de webhooks firmados. El secreto de firma solo se muestra una
 * vez, al crear la suscripción: el integrador lo guarda en su backend.
 */
interface WebhookSubscriptionsPanelProps {
  /** Administradores: pueden crear el webhook a nombre de una billetera cliente. */
  canIssueForClient: boolean;
}

export function WebhookSubscriptionsPanel({ canIssueForClient }: WebhookSubscriptionsPanelProps) {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscriptionRecord[]>([]);
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [events, setEvents] = useState<SubscribableWebhookEvent[]>(['payment_request.paid', 'payment_request.cancelled']);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const rows = await getWebhookSubscriptions();
      setSubscriptions(rows.filter((row) => row.status !== 'disabled'));
    } catch {
      setError('No se pudieron cargar los webhooks.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function toggleEvent(event: SubscribableWebhookEvent) {
    setEvents((current) => (current.includes(event) ? current.filter((item) => item !== event) : [...current, event]));
  }

  async function handleCreate(formEvent: FormEvent) {
    formEvent.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await createWebhookSubscription({
        name: name.trim(),
        target_url: targetUrl.trim(),
        event_types: events,
        ...(canIssueForClient && ownerPhone.trim() ? { owner_phone: ownerPhone.trim() } : {}),
      });
      setCreatedSecret(result.subscription.signing_secret);
      setName('');
      setTargetUrl('');
      setOwnerPhone('');
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el webhook.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable(id: string) {
    setError(null);
    try {
      await disableWebhookSubscription(id);
      await refresh();
    } catch {
      setError('No se pudo desactivar el webhook.');
    }
  }

  return (
    <div className="space-y-4">
      {createdSecret && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs font-bold text-foreground">Secreto de firma (solo se muestra ahora)</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-xs">{createdSecret}</code>
            <Button type="button" size="sm" variant="ghost" aria-label="Copiar secreto" onClick={() => navigator.clipboard?.writeText(createdSecret)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-3 rounded-3xl border border-border/10 bg-background/70 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="webhook-name">Nombre</Label>
            <Input id="webhook-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="CasasEG" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="webhook-url">URL de destino (https)</Label>
            <Input id="webhook-url" type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://.../functions/v1/rental-payment-callback" required />
          </div>
        </div>
        {canIssueForClient && (
          <div className="space-y-1">
            <Label htmlFor="webhook-owner-phone">Billetera titular (opcional)</Label>
            <Input
              id="webhook-owner-phone"
              type="tel"
              value={ownerPhone}
              onChange={(event) => setOwnerPhone(event.target.value)}
              placeholder="Teléfono de la cuenta cliente, p. ej. la de CasasEG"
            />
            <p className="text-xs text-muted-foreground">
              Debe ser la misma billetera que la de la credencial: solo así este webhook recibe sus cobros.
            </p>
          </div>
        )}
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-xs font-bold text-muted-foreground">Eventos</legend>
          {SUBSCRIBABLE_WEBHOOK_EVENTS.map((event) => (
            <label key={event} className="flex cursor-pointer items-start gap-3 text-xs">
              <input type="checkbox" checked={events.includes(event)} onChange={() => toggleEvent(event)} className="mt-0.5 h-4 w-4 accent-pink-600" />
              <span><code className="font-bold text-primary">{event}</code> — {WEBHOOK_EVENT_DESCRIPTIONS[event]}</span>
            </label>
          ))}
        </fieldset>
        {error && <p className="text-xs font-semibold text-destructive" role="alert">{error}</p>}
        <Button type="submit" size="sm" disabled={saving || events.length === 0}>
          <Plus className="h-4 w-4" />
          {saving ? 'Creando…' : 'Crear webhook'}
        </Button>
      </form>

      <div className="grid gap-3">
        {subscriptions.map((subscription) => (
          <div key={subscription.id} className="flex items-start justify-between gap-3 rounded-3xl border border-border/10 bg-background/70 p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{subscription.name}</p>
              {subscription.owner_label && (
                <p className="text-xs font-semibold text-foreground">Titular: {subscription.owner_label}</p>
              )}
              <p className="break-all font-mono text-xs text-muted-foreground">{subscription.target_url}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {subscription.event_types.map((event) => (
                  <Badge key={event} variant="secondary" className="font-mono text-[10px]">{event}</Badge>
                ))}
              </div>
            </div>
            <Button type="button" size="sm" variant="ghost" aria-label={`Desactivar ${subscription.name}`} onClick={() => handleDisable(subscription.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
