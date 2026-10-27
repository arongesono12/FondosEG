'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Copy,
  KeyRound,
  Package,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
} from '@/components/ui/hugeicons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApplicationIcon } from '@/components/developers/application-icon';
import {
  ApplicationSettingsDialog,
  CreateApplicationDialog,
  CreateCredentialDialog,
  PERMISSION_LABELS,
  PERMISSION_ORDER,
} from '@/components/developers/application-dialogs';
import { SecretRevealDialog } from '@/components/developers/secret-reveal-dialog';
import { WebhookSubscriptionsPanel } from '@/components/developers/webhook-subscriptions-panel';
import { cn, formatCurrency, formatDateShort } from '@/lib/utils';
import { archiveApiApplication, getApiApplications } from '@/services/api-applications';
import { getApiKeys, getApiKeyUsage, revokeApiKey, rotateApiKey } from '@/services/api-keys';
import { getWebhookSubscriptions, type WebhookSubscriptionRecord } from '@/services/webhooks';
import type { ApiApplication, ApiKeyRecord, ApiUsageResponse, CreatedApiKeyResponse } from '@/types';

type RevealedCredential = CreatedApiKeyResponse['apiKey'] & { rotated?: boolean };

interface ApplicationsPanelProps {
  canIssueProduction: boolean;
}

const COPIED_FEEDBACK_MS = 1600;
const RECENT_ACTIVITY_ROWS = 6;

const ENVIRONMENT_BADGE: Record<ApiKeyRecord['environment'], { label: string; className: string }> = {
  test: { label: 'Prueba', className: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300' },
  production: { label: 'Producción', className: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300' },
};

function maskKey(apiKey: string): string {
  return apiKey.length > 18 ? `${apiKey.slice(0, 12)}…${apiKey.slice(-4)}` : apiKey;
}

function permissionSummary(key: ApiKeyRecord): string {
  const labels = PERMISSION_ORDER.filter((permission) => key.permissions?.[permission]).map(
    (permission) => PERMISSION_LABELS[permission].label
  );
  return labels.length > 0 ? labels.join(', ') : 'Sin permisos';
}

export function ApplicationsPanel({ canIssueProduction }: ApplicationsPanelProps) {
  const [applications, setApplications] = useState<ApiApplication[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubscriptionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usage, setUsage] = useState<ApiUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createAppOpen, setCreateAppOpen] = useState(false);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revealed, setRevealed] = useState<RevealedCredential | null>(null);
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [apps, keys, subscriptions] = await Promise.all([
        getApiApplications(),
        getApiKeys(),
        getWebhookSubscriptions(),
      ]);
      setApplications(apps);
      setApiKeys(keys);
      setWebhooks(subscriptions.filter((subscription) => subscription.status !== 'disabled'));
      setSelectedId((current) => (current && apps.some((app) => app.id === current) ? current : apps[0]?.id ?? null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las aplicaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = applications.find((application) => application.id === selectedId) ?? null;
  const selectedKeys = useMemo(
    () => apiKeys.filter((key) => key.application_id === selectedId),
    [apiKeys, selectedId]
  );
  const selectedWebhooks = useMemo(
    () => webhooks.filter((subscription) => subscription.application_id === selectedId),
    [webhooks, selectedId]
  );
  const orphanKeys = apiKeys.filter((key) => !key.application_id);

  useEffect(() => {
    if (!selectedId) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    getApiKeyUsage({ applicationId: selectedId })
      .then((data) => { if (!cancelled) setUsage(data); })
      .catch(() => { if (!cancelled) setUsage(null); });
    return () => { cancelled = true; };
  }, [selectedId, apiKeys]);

  async function copyKey(key: ApiKeyRecord) {
    try {
      await navigator.clipboard.writeText(key.api_key);
      setCopiedKeyId(key.id);
      window.setTimeout(() => setCopiedKeyId(null), COPIED_FEEDBACK_MS);
    } catch {
      setCopiedKeyId(null);
    }
  }

  async function handleRotate(key: ApiKeyRecord) {
    if (!window.confirm('Se generará un secret nuevo y el actual dejará de funcionar de inmediato. ¿Continuar?')) return;
    setBusyKeyId(key.id);
    try {
      const response = await rotateApiKey(key.id);
      setRevealed({ ...response.apiKey, rotated: true });
      setApiKeys((current) => current.map((item) => (item.id === key.id ? { ...item, ...response.apiKey } : item)));
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'No se pudo rotar la credencial.');
    } finally {
      setBusyKeyId(null);
    }
  }

  async function handleRevoke(key: ApiKeyRecord) {
    if (!window.confirm('La credencial dejará de funcionar de inmediato. ¿Revocarla?')) return;
    setBusyKeyId(key.id);
    try {
      await revokeApiKey(key.id);
      setApiKeys((current) => current.filter((item) => item.id !== key.id));
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'No se pudo revocar la credencial.');
    } finally {
      setBusyKeyId(null);
    }
  }

  async function handleArchive(application: ApiApplication) {
    const confirmed = window.confirm(
      `¿Archivar ${application.name}? Se revocan sus credenciales y webhooks. Su billetera y su saldo se conservan.`
    );
    if (!confirmed) return;
    try {
      await archiveApiApplication(application.id);
      setSelectedId(null);
      await load();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'No se pudo archivar la aplicación.');
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-[28rem] rounded-3xl" />
      </div>
    );
  }

  const revealedEnv = revealed
    ? [
        `FONDOSEG_BASE_URL=${typeof window === 'undefined' ? 'https://fondoseg.com' : window.location.origin}`,
        `FONDOSEG_API_KEY=${revealed.api_key}`,
        `FONDOSEG_API_SECRET=${revealed.api_secret}`,
      ].join('\n')
    : undefined;

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" className="text-xs font-medium underline-offset-2 hover:underline" onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="app-card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Package className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Crea tu primera aplicación</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Una aplicación agrupa su billetera, sus credenciales y sus webhooks. Por ejemplo: CasasEG.
          </p>
          <Button className="mt-5" onClick={() => setCreateAppOpen(true)}>
            <Plus /> Nueva aplicación
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3" aria-label="Aplicaciones">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Aplicaciones</h2>
              <Button size="sm" variant="outline" onClick={() => setCreateAppOpen(true)}>
                <Plus /> Nueva
              </Button>
            </div>
            <ul className="space-y-1.5">
              {applications.map((application) => {
                const active = application.id === selectedId;
                return (
                  <li key={application.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(application.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                        active ? 'border-primary/40 bg-primary/5' : 'border-border bg-background hover:bg-muted/50'
                      )}
                    >
                      <ApplicationIcon name={application.name} iconUrl={application.icon_url} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <span className="truncate">{application.name}</span>
                          {application.is_trusted && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-label="Verificada" />}
                        </span>
                        <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(application.wallet.available_balance, application.wallet.currency)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {selected && (
            <section className="app-card space-y-7 p-5 md:p-6" aria-labelledby="application-heading">
              <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <ApplicationIcon name={selected.name} iconUrl={selected.icon_url} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="application-heading" className="truncate text-xl font-semibold tracking-tight text-foreground">{selected.name}</h2>
                      {selected.is_trusted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300">
                          <BadgeCheck className="h-3 w-3" /> Verificada
                        </span>
                      )}
                    </div>
                    {selected.description && <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>}
                    {!selected.has_dedicated_wallet && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                        Aplicación anterior: opera la billetera de la cuenta para la que se emitió.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button onClick={() => setCreateKeyOpen(true)}>
                    <KeyRound /> Nueva credencial
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    aria-label={`Configurar ${selected.name}`}
                    title="Configuración"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Archivar ${selected.name}`}
                    title="Archivar aplicación"
                    onClick={() => handleArchive(selected)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </header>

              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Saldo disponible</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                    {formatCurrency(selected.wallet.available_balance, selected.wallet.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Credenciales</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{selectedKeys.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Webhooks</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{selectedWebhooks.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Llamadas recientes</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                    {usage?.summary.total ?? 0}
                    {(usage?.summary.errors ?? 0) > 0 && (
                      <span className="ml-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{usage?.summary.errors} con error</span>
                    )}
                  </dd>
                </div>
              </dl>

              <section aria-labelledby="credentials-heading" className="space-y-3">
                <div>
                  <h3 id="credentials-heading" className="text-sm font-semibold text-foreground">Credenciales</h3>
                  <p className="text-xs text-muted-foreground">Úsalas solo desde tu servidor. El secret se muestra una única vez.</p>
                </div>
                {selectedKeys.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                    Sin credenciales. Crea una de prueba para empezar a integrar.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {selectedKeys.map((key) => (
                      <li key={key.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
                        <span className={cn('w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ENVIRONMENT_BADGE[key.environment].className)}>
                          {ENVIRONMENT_BADGE[key.environment].label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs text-foreground" title={key.api_key}>{maskKey(key.api_key)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {permissionSummary(key)} · {key.last_used_at ? `Último uso ${formatDateShort(key.last_used_at)}` : 'Sin uso'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => copyKey(key)} aria-label="Copiar API key">
                            <Copy /> {copiedKeyId === key.id ? 'Copiada' : 'Copiar'}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busyKeyId === key.id} onClick={() => handleRotate(key)}>
                            <RefreshCw className={cn(busyKeyId === key.id && 'animate-spin')} /> Rotar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={busyKeyId === key.id}
                            onClick={() => handleRevoke(key)}
                            aria-label="Revocar credencial"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <WebhookSubscriptionsPanel application={selected} subscriptions={selectedWebhooks} onChanged={load} />

              <section aria-labelledby="activity-heading" className="space-y-3">
                <h3 id="activity-heading" className="text-sm font-semibold text-foreground">Actividad reciente</h3>
                {!usage || usage.logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no hay llamadas con las credenciales de esta aplicación.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {usage.logs.slice(0, RECENT_ACTIVITY_ROWS).map((log) => (
                      <li key={log.id} className="flex items-center gap-3 px-3 py-2">
                        <span className={cn(
                          'w-10 shrink-0 text-center font-mono text-xs font-semibold',
                          log.status_code < 400 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        )}>
                          {log.status_code}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{log.method} {log.path}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{log.latency_ms} ms</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </section>
          )}
        </div>
      )}

      {orphanKeys.length > 0 && (
        <section className="app-card space-y-3 p-5" aria-labelledby="orphan-heading">
          <div>
            <h3 id="orphan-heading" className="text-sm font-semibold text-foreground">Credenciales sin aplicación</h3>
            <p className="text-xs text-muted-foreground">
              Emitidas antes de las aplicaciones. Siguen funcionando; revócalas cuando las sustituyas.
            </p>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {orphanKeys.map((key) => (
              <li key={key.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{key.app_name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{maskKey(key.api_key)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={busyKeyId === key.id}
                  onClick={() => handleRevoke(key)}
                  aria-label={`Revocar ${key.app_name}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CreateApplicationDialog
        open={createAppOpen}
        onOpenChange={setCreateAppOpen}
        onCreated={(application, iconError) => {
          setApplications((current) => [application, ...current]);
          setSelectedId(application.id);
          if (iconError) setError(iconError);
        }}
      />

      <ApplicationSettingsDialog
        application={selected}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={(applicationId, patch) => {
          setApplications((current) => current.map((item) => (item.id === applicationId ? { ...item, ...patch } : item)));
          // El nombre se repite en las credenciales (ver PATCH /api/applications/[id]).
          const { name } = patch;
          if (name) {
            setApiKeys((current) => current.map((key) => (
              key.application_id === applicationId ? { ...key, app_name: name } : key
            )));
          }
        }}
      />

      <CreateCredentialDialog
        application={selected}
        open={createKeyOpen}
        onOpenChange={setCreateKeyOpen}
        canIssueProduction={canIssueProduction}
        onCreated={(credential) => {
          setApiKeys((current) => [credential, ...current]);
          setRevealed(credential);
        }}
      />

      <SecretRevealDialog
        open={revealed !== null}
        onOpenChange={(open) => { if (!open) setRevealed(null); }}
        title={revealed?.rotated ? 'Secret rotado' : 'Credencial creada'}
        description={
          revealed
            ? `${revealed.app_name} · ${ENVIRONMENT_BADGE[revealed.environment].label}. Guárdala en las variables de entorno de tu servidor.`
            : ''
        }
        values={revealed ? [
          { label: 'API key', value: revealed.api_key },
          { label: 'API secret', value: revealed.api_secret },
        ] : []}
        envSnippet={revealedEnv}
      />
    </div>
  );
}
