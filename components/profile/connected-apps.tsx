'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

interface ConnectedApp {
  id: string;
  merchant_name: string;
  created_at: string;
  last_used_at: string | null;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

/** Apps con acceso de solo lectura al saldo; el cliente puede retirarlo. */
export function ConnectedApps() {
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/wallet-links');
      const result = (await response.json().catch(() => ({}))) as { links?: ConnectedApp[]; error?: string };
      if (!response.ok) {
        setError(result.error || 'No se pudieron cargar las apps conectadas.');
        setApps([]);
        return;
      }
      setError(null);
      setApps(result.links ?? []);
    } catch {
      setError('Sin conexión. No se pudieron cargar las apps conectadas.');
      setApps([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      const response = await fetch(`/api/wallet-links/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error || 'No se pudo retirar el acceso.');
        return;
      }
      setApps((current) => (current ?? []).filter((app) => app.id !== id));
    } catch {
      setError('Sin conexión. No se pudo retirar el acceso.');
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card className="text-card-foreground">
      <CardHeader>
        <h2 className="text-xl font-semibold text-foreground">Apps conectadas</h2>
        <CardDescription>Aplicaciones que pueden ver tu saldo. Ninguna puede mover tu dinero.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm font-semibold text-destructive" role="alert">{error}</p>}
        {apps === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No has conectado ninguna aplicación.</p>
        ) : (
          apps.map((app) => (
            <div
              key={app.id}
              className="flex flex-col gap-3 rounded-xl border border-border/20 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900/60"
            >
              <div>
                <p className="font-semibold text-foreground">{app.merchant_name}</p>
                <p className="text-xs text-muted-foreground">
                  Ve tu saldo · conectada el {formatDate(app.created_at)}
                  {app.last_used_at ? ` · último acceso ${formatDate(app.last_used_at)}` : ''}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={revokingId === app.id}
                onClick={() => revoke(app.id)}
              >
                {revokingId === app.id ? 'Retirando…' : 'Retirar acceso'}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
