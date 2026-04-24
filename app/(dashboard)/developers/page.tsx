'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType, FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Code2,
  Copy,
  History,
  KeyRound,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { cn, formatDateShort } from '@/lib/utils';
import { isAdminRole } from '@/lib/roles';
import { createApiKey, getApiKeyUsage, getApiKeys, revokeApiKey, rotateApiKey } from '@/services/api-keys';
import type { ApiKeyRecord, ApiPermission, ApiUsageResponse, CreateApiKeyData, RotateApiKeyResponse, UserRole } from '@/types';

const permissionLabels: Record<ApiPermission, { label: string; icon: ElementType; detail: string }> = {
  balance: { label: 'Saldos', icon: Wallet, detail: 'Lectura de balances disponibles.' },
  transfer: { label: 'Transferencias', icon: Send, detail: 'Creación de movimientos externos.' },
  history: { label: 'Historial', icon: History, detail: 'Consulta de operaciones y estados.' },
};

const endpointDocs = [
  {
    method: 'GET',
    path: '/api/external/balance',
    title: 'Consultar saldo',
    scope: 'balance',
    description: 'Devuelve el saldo disponible según el rol de la credencial.',
  },
  {
    method: 'POST',
    path: '/api/external/transfer',
    title: 'Crear envío de gestor',
    scope: 'transfer',
    description: 'Registra un envío FondosEG y descuenta el float del gestor.',
  },
  {
    method: 'POST',
    path: '/api/external/wallet-transfer',
    title: 'Transferencia entre clientes',
    scope: 'transfer',
    description: 'Mueve saldo entre billeteras de clientes FondosEG.',
  },
  {
    method: 'GET',
    path: '/api/external/history?limit=20&offset=0',
    title: 'Historial de operaciones',
    scope: 'history',
    description: 'Lista operaciones visibles para la credencial autenticada.',
  },
] as const;

const defaultPermissions: Record<ApiPermission, boolean> = {
  balance: true,
  transfer: true,
  history: true,
};

function getRoleOptions(role?: string | null): UserRole[] {
  if (isAdminRole(role)) {
    return ['gestor', 'cliente', 'admin'];
  }
  if (role === 'gestor') return ['gestor'];
  return ['cliente'];
}

function createInitialForm(role?: string | null): CreateApiKeyData {
  const role_access = getRoleOptions(role)[0];
  return {
    app_name: '',
    app_description: '',
    role_access,
    permissions: defaultPermissions,
  };
}

function permissionSummary(key: ApiKeyRecord) {
  return (Object.keys(permissionLabels) as ApiPermission[])
    .filter((permission) => key.permissions?.[permission])
    .map((permission) => permissionLabels[permission].label)
    .join(', ');
}

export default function DevelopersPage() {
  const { user } = useAppStore();
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateApiKeyData>(() => createInitialForm(user?.role));
  const [createdCredential, setCreatedCredential] = useState<(ApiKeyRecord & { api_secret: string }) | null>(null);
  const [usage, setUsage] = useState<ApiUsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = useMemo(() => getRoleOptions(user?.role), [user?.role]);
  const selectedKey = apiKeys.find((key) => key.id === selectedKeyId) || apiKeys[0] || null;
  const activeCredential = createdCredential || selectedKey;
  const baseUrl = typeof window === 'undefined' ? 'https://fondoseg.com' : window.location.origin;
  const openApiUrl = `${baseUrl}/api/docs/openapi.json`;

  useEffect(() => {
    setForm(createInitialForm(user?.role));
  }, [user?.role]);

  useEffect(() => {
    async function loadApiKeys() {
      try {
        setError(null);
        const keys = await getApiKeys();
        setApiKeys(keys);
        setSelectedKeyId((current) => current || keys[0]?.id || null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las credenciales.');
      } finally {
        setLoading(false);
      }
    }

    loadApiKeys();
  }, []);

  useEffect(() => {
    async function loadUsage() {
      if (!selectedKeyId) {
        setUsage(null);
        return;
      }

      setUsageLoading(true);
      try {
        const data = await getApiKeyUsage(selectedKeyId);
        setUsage(data);
      } catch {
        setUsage(null);
      } finally {
        setUsageLoading(false);
      }
    }

    loadUsage();
  }, [selectedKeyId]);

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function handleCreateKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setCreatedCredential(null);

    try {
      const response = await createApiKey(form);
      setCreatedCredential(response.apiKey);
      setApiKeys((current) => [response.apiKey, ...current]);
      setSelectedKeyId(response.apiKey.id);
      setForm(createInitialForm(user?.role));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la credencial.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeKey(id: string) {
    setError(null);
    try {
      await revokeApiKey(id);
      setApiKeys((current) => current.filter((key) => key.id !== id));
      setSelectedKeyId((current) => (current === id ? null : current));
      if (createdCredential?.id === id) setCreatedCredential(null);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'No se pudo revocar la credencial.');
    }
  }

  async function handleRotateKey(id: string) {
    setRotatingKeyId(id);
    setError(null);

    try {
      const response: RotateApiKeyResponse = await rotateApiKey(id);
      setCreatedCredential(response.apiKey);
      setApiKeys((current) => current.map((key) => (key.id === id ? response.apiKey : key)));
      setSelectedKeyId(id);
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'No se pudo rotar la credencial.');
    } finally {
      setRotatingKeyId(null);
    }
  }

  function togglePermission(permission: ApiPermission) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [permission]: !current.permissions[permission],
      },
    }));
  }

  const headerSnippet = activeCredential
    ? `x-api-key: ${activeCredential.api_key}\nx-api-secret: ${
        'api_secret' in activeCredential ? activeCredential.api_secret : '<API_SECRET>'
      }\nidempotency-key: <UUID_UNICO_POR_OPERACION>`
    : 'x-api-key: <API_KEY>\nx-api-secret: <API_SECRET>\nidempotency-key: <UUID_UNICO_POR_OPERACION>';

  const curlSnippet = `curl -X GET "${baseUrl}/api/external/balance" \\
  -H "x-api-key: ${activeCredential?.api_key || '<API_KEY>'}" \\
  -H "x-api-secret: ${activeCredential && 'api_secret' in activeCredential ? activeCredential.api_secret : '<API_SECRET>'}"`;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-4xl" />
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
          <Skeleton className="h-96 rounded-4xl" />
          <Skeleton className="h-96 rounded-4xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="overflow-hidden rounded-4xl border border-border/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,250,252,0.72))] p-6 shadow-2xl shadow-slate-200/40 backdrop-blur-xl dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(2,6,23,0.82))] dark:shadow-black/20 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <Badge className="w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
              FondosEG API
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Portal de desarrolladores</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground md:text-base">
                Emite credenciales, controla permisos y prueba los endpoints externos que conectan FondosEG con otros productos.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/10 bg-background/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Credenciales</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{apiKeys.length}</p>
            </div>
            <div className="rounded-2xl border border-border/10 bg-background/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rate limit</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{selectedKey?.rate_limit || 100}/h</p>
            </div>
            <div className="rounded-2xl border border-border/10 bg-background/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Endpoints</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{endpointDocs.length}</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {createdCredential && (
        <section className="rounded-4xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="font-bold text-foreground">Credencial creada para {createdCredential.app_name}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">El secret completo solo se muestra ahora.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-2xl bg-background/80" onClick={() => copyText('api-key', createdCredential.api_key)}>
                <Copy className="h-4 w-4" />
                {copied === 'api-key' ? 'Copiado' : 'API key'}
              </Button>
              <Button className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => copyText('api-secret', createdCredential.api_secret)}>
                <Copy className="h-4 w-4" />
                {copied === 'api-secret' ? 'Copiado' : 'API secret'}
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <KeyRound className="h-5 w-5 text-primary" />
              Nueva credencial
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form className="space-y-5" onSubmit={handleCreateKey}>
              <div className="grid gap-2">
                <Label htmlFor="app_name">Nombre de la app</Label>
                <Input
                  id="app_name"
                  value={form.app_name}
                  onChange={(event) => setForm((current) => ({ ...current, app_name: event.target.value }))}
                  placeholder="Mi app externa"
                  required
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="app_description">Descripción</Label>
                <Textarea
                  id="app_description"
                  value={form.app_description}
                  onChange={(event) => setForm((current) => ({ ...current, app_description: event.target.value }))}
                  placeholder="Uso previsto de la integración"
                  className="min-h-24 rounded-2xl"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role_access">Rol de acceso</Label>
                <select
                  id="role_access"
                  value={form.role_access}
                  onChange={(event) => setForm((current) => ({ ...current, role_access: event.target.value as UserRole }))}
                  className="h-11 rounded-2xl border border-input bg-background px-3 text-sm font-medium shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <Label>Permisos</Label>
                <div className="grid gap-3">
                  {(Object.keys(permissionLabels) as ApiPermission[]).map((permission) => {
                    const Icon = permissionLabels[permission].icon;
                    const active = form.permissions[permission];
                    return (
                      <button
                        key={permission}
                        type="button"
                        onClick={() => togglePermission(permission)}
                        className={cn(
                          'flex items-center justify-between rounded-3xl border p-4 text-left transition-colors',
                          active ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-border/10 bg-background/70'
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', active ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground')}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block text-sm font-bold text-foreground">{permissionLabels[permission].label}</span>
                            <span className="block text-xs font-medium text-muted-foreground">{permissionLabels[permission].detail}</span>
                          </span>
                        </span>
                        <span className={cn('h-3 w-3 rounded-full', active ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button type="submit" disabled={saving} className="h-12 w-full rounded-2xl bg-brand-gradient text-base font-bold text-white shadow-xl shadow-pink-500/20">
                <Plus className="h-4 w-4" />
                {saving ? 'Creando...' : 'Crear credencial'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Credenciales activas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {apiKeys.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-muted-foreground">Aún no hay credenciales activas.</p>
                </div>
              ) : apiKeys.map((key) => (
                <div
                  key={key.id}
                  onClick={() => {
                    setSelectedKeyId(key.id);
                    setCreatedCredential(null);
                  }}
                  className={cn(
                    'w-full cursor-pointer rounded-[1.75rem] border p-4 text-left transition-colors',
                    selectedKey?.id === key.id ? 'border-primary/25 bg-primary/10' : 'border-border/10 bg-background/70 hover:bg-background'
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-foreground">{key.app_name}</p>
                        <Badge className="rounded-full bg-slate-900 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white dark:bg-white dark:text-slate-900">
                          {key.role_access}
                        </Badge>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{key.api_key}</p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">{permissionSummary(key) || 'Sin permisos activos'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl bg-background/70"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRotateKey(key.id);
                        }}
                        disabled={rotatingKeyId === key.id}
                      >
                        <RefreshCw className={cn('h-4 w-4', rotatingKeyId === key.id && 'animate-spin')} />
                        {rotatingKeyId === key.id ? 'Rotando' : 'Rotar'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl bg-background/70"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyText(`key-${key.id}`, key.api_key);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        {copied === `key-${key.id}` ? 'Copiada' : 'Copiar'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-xl text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRevokeKey(key.id);
                        }}
                        aria-label={`Revocar ${key.app_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-xs font-semibold text-muted-foreground sm:grid-cols-3">
                    <span>Secret: {key.api_secret_preview || 'solo visible al crear'}</span>
                    <span>Creada: {formatDateShort(key.created_at)}</span>
                    <span>Ultimo uso: {key.last_used_at ? formatDateShort(key.last_used_at) : 'sin uso'}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Code2 className="h-5 w-5 text-primary" />
                Prueba rápida
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-3xl border border-border/10 bg-slate-950 p-4 text-slate-100">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Headers</p>
                  <Button type="button" size="sm" variant="ghost" className="rounded-xl text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => copyText('headers', headerSnippet)}>
                    <Copy className="h-4 w-4" />
                    {copied === 'headers' ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6">{headerSnippet}</pre>
              </div>

              <div className="rounded-3xl border border-border/10 bg-slate-950 p-4 text-slate-100">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">cURL</p>
                  <Button type="button" size="sm" variant="ghost" className="rounded-xl text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => copyText('curl', curlSnippet)}>
                    <Copy className="h-4 w-4" />
                    {copied === 'curl' ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6">{curlSnippet}</pre>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <BookOpen className="h-5 w-5 text-primary" />
                Contrato y actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">OpenAPI 3.1</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{openApiUrl}</p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-2xl bg-background/80" onClick={() => copyText('openapi', openApiUrl)}>
                    <Copy className="h-4 w-4" />
                    {copied === 'openapi' ? 'Copiado' : 'Copiar URL'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Requests</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{usageLoading ? '...' : usage?.summary.total ?? 0}</p>
                </div>
                <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Exitosos</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-300">{usageLoading ? '...' : usage?.summary.success ?? 0}</p>
                </div>
                <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Errores</p>
                  <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-300">{usageLoading ? '...' : usage?.summary.errors ?? 0}</p>
                </div>
              </div>

              <div className="space-y-2">
                {(usage?.logs || []).slice(0, 5).map((log) => (
                  <div key={log.id} className="flex flex-col gap-2 rounded-3xl border border-border/10 bg-background/70 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-mono text-xs font-bold text-foreground">{log.method} {log.path}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">{log.request_id}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn('rounded-full px-2 py-1 text-[10px] font-bold', log.status_code < 400 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                        {log.status_code}
                      </Badge>
                      <span className="text-xs font-semibold text-muted-foreground">{log.latency_ms}ms</span>
                    </div>
                  </div>
                ))}
                {!usageLoading && (usage?.logs.length ?? 0) === 0 && (
                  <p className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-5 py-6 text-center text-sm font-semibold text-muted-foreground">
                    Aun no hay actividad registrada para esta credencial.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {endpointDocs.map((endpoint) => (
          <div key={`${endpoint.method}-${endpoint.path}`} className="rounded-3xl border border-border/10 bg-background/70 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <Badge className={cn('rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', endpoint.method === 'GET' ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white')}>
                {endpoint.method}
              </Badge>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{endpoint.scope}</span>
            </div>
            <p className="mt-4 text-sm font-bold text-foreground">{endpoint.title}</p>
            <p className="mt-2 break-all font-mono text-xs text-primary">{endpoint.path}</p>
            <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">{endpoint.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-4xl border border-border/10 bg-background/70 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-1 h-5 w-5 text-primary" />
          <div>
            <p className="font-bold text-foreground">Estado de la plataforma API</p>
            <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
              Las credenciales nuevas usan secret hasheado, rate limit por ventana, request IDs, logs de uso e idempotencia para operaciones de dinero cuando se envía el header `idempotency-key`.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
