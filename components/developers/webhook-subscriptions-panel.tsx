'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, Webhook } from '@/components/ui/hugeicons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretRevealDialog } from '@/components/developers/secret-reveal-dialog';
import {
  SUBSCRIBABLE_WEBHOOK_EVENTS,
  WEBHOOK_EVENT_DESCRIPTIONS,
  type SubscribableWebhookEvent,
} from '@/lib/server/webhook-events';
import {
  createWebhookSubscription,
  disableWebhookSubscription,
  type WebhookSubscriptionRecord,
} from '@/services/webhooks';
import type { ApiApplication } from '@/types';

/** Los eventos de agentes no aplican a la billetera de una aplicación. */
const APPLICATION_EVENTS = SUBSCRIBABLE_WEBHOOK_EVENTS.filter(
  (event) => event.startsWith('payment_request.') || event === 'wallet_transfer.confirmed'
);

const DEFAULT_EVENTS: SubscribableWebhookEvent[] = ['payment_request.paid', 'payment_request.cancelled', 'wallet_transfer.confirmed'];

interface WebhookSubscriptionsPanelProps {
  application: ApiApplication;
  subscriptions: WebhookSubscriptionRecord[];
  onChanged: () => void;
}

/**
 * Webhooks firmados de una aplicación. El secreto de firma solo se muestra
 * una vez, al crear la suscripción.
 */
export function WebhookSubscriptionsPanel({ application, subscriptions, onChanged }: WebhookSubscriptionsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [events, setEvents] = useState<SubscribableWebhookEvent[]>(DEFAULT_EVENTS);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  function resetForm() {
    setTargetUrl('');
    setEvents(DEFAULT_EVENTS);
    setError(null);
  }

  function toggleEvent(event: SubscribableWebhookEvent) {
    setEvents((current) => (current.includes(event) ? current.filter((item) => item !== event) : [...current, event]));
  }

  async function handleCreate(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await createWebhookSubscription({
        application_id: application.id,
        target_url: targetUrl.trim(),
        event_types: events,
      });
      setDialogOpen(false);
      resetForm();
      setCreatedSecret(result.subscription.signing_secret);
      onChanged();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el webhook.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable(subscription: WebhookSubscriptionRecord) {
    if (!window.confirm(`¿Desactivar el webhook ${subscription.target_url}? Dejará de recibir eventos.`)) return;
    setDisablingId(subscription.id);
    try {
      await disableWebhookSubscription(subscription.id);
      onChanged();
    } catch {
      window.alert('No se pudo desactivar el webhook.');
    } finally {
      setDisablingId(null);
    }
  }

  return (
    <section aria-labelledby="webhooks-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="webhooks-heading" className="text-sm font-semibold text-foreground">Webhooks</h3>
          <p className="text-xs text-muted-foreground">Avisos firmados de cobros y envíos de esta aplicación.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus /> Añadir
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          Sin webhooks. Añade uno para enterarte al instante de cada pago.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {subscriptions.map((subscription) => (
            <li key={subscription.id} className="flex items-center gap-3 px-3 py-2.5">
              <Webhook className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-foreground" title={subscription.target_url}>{subscription.target_url}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {subscription.event_types.join(' · ')}
                  {subscription.status === 'paused' && ' · en pausa'}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Desactivar ${subscription.target_url}`}
                disabled={disablingId === subscription.id}
                onClick={() => handleDisable(subscription)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={(next) => { if (!next) resetForm(); setDialogOpen(next); }}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Añadir webhook</DialogTitle>
            <DialogDescription>Para {application.name}. FondosEG firma cada evento con HMAC SHA-256.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="create-webhook-form" className="space-y-5" onSubmit={handleCreate}>
              <div className="space-y-1.5">
                <Label htmlFor="webhook-url">URL de destino</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  placeholder="https://tuapp.com/webhooks/fondoseg"
                  required
                  autoFocus
                />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Eventos</legend>
                <div className="divide-y divide-border rounded-xl border border-border">
                  {APPLICATION_EVENTS.map((event) => (
                    <label key={event} className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="mt-0.5 h-4 w-4 accent-pink-600"
                      />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-medium text-foreground">{event}</span>
                        <span className="block text-xs text-muted-foreground">{WEBHOOK_EVENT_DESCRIPTIONS[event]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" form="create-webhook-form" disabled={saving || events.length === 0}>
              {saving ? 'Creando…' : 'Crear webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SecretRevealDialog
        open={createdSecret !== null}
        onOpenChange={(open) => { if (!open) setCreatedSecret(null); }}
        title="Webhook creado"
        description="Usa este secreto para verificar la firma de cada evento."
        values={createdSecret ? [{ label: 'Secreto de firma', value: createdSecret }] : []}
        envSnippet={createdSecret ? `FONDOSEG_WEBHOOK_SECRET=${createdSecret}` : undefined}
      />
    </section>
  );
}
