'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { Button } from '@/components/ui/button';

interface WalletLinkConsentProps {
  requestId: string;
  merchantName: string;
  /** Dominio al que se vuelve tras decidir: el cliente comprueba que es el de la app. */
  destinationHost: string;
  expiresAt: string;
  isOwnRequest: boolean;
  isClient: boolean;
}

type ConsentState = 'idle' | 'submitting' | 'done';

/**
 * Consentimiento para que un comercio lea el saldo de la billetera. Solo
 * lectura: el comercio no puede mover dinero ni ver movimientos.
 */
export function WalletLinkConsent(props: WalletLinkConsentProps) {
  const [state, setState] = useState<ConsentState>('idle');
  const [error, setError] = useState<string | null>(null);

  const blockedReason = props.isOwnRequest
    ? 'No puedes vincular tu billetera con tu propio comercio.'
    : !props.isClient
      ? 'Solo las billeteras de cliente pueden vincularse a otras aplicaciones.'
      : null;

  async function decide(action: 'approve' | 'deny') {
    setState('submitting');
    setError(null);
    try {
      const response = await fetch(`/api/wallet-links/requests/${encodeURIComponent(props.requestId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => ({}))) as { redirect_url?: string | null; error?: string };
      if (!response.ok) {
        setError(result.error || 'No se pudo completar la operación. Inténtalo de nuevo.');
        setState('idle');
        return;
      }
      setState('done');
      if (result.redirect_url) window.location.assign(result.redirect_url);
    } catch {
      setError('Sin conexión. Comprueba tu red e inténtalo de nuevo.');
      setState('idle');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="app-card w-full max-w-md p-6 sm:p-8">
        <DashboardLogo size="lg" className="justify-center mb-6" iconClassName="h-12 w-12 rounded-full" labelClassName="text-3xl" />

        <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Vincular billetera</p>
        <h1 className="mt-2 text-center text-xl font-black text-foreground">{props.merchantName}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">quiere ver el saldo de tu billetera FondosEG.</p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Al terminar volverás a <span className="font-mono font-semibold text-foreground">{props.destinationHost}</span>.
          Si no es la aplicación que estabas usando, rechaza.
        </p>

        <ul className="mt-6 space-y-2 rounded-2xl border border-border/30 bg-muted/30 p-4 text-sm text-foreground">
          <li className="flex gap-2"><span aria-hidden className="font-black text-emerald-600">✓</span>Podrá ver tu saldo disponible antes de que pagues.</li>
          <li className="flex gap-2"><span aria-hidden className="font-black text-rose-600">✕</span>No podrá mover dinero de tu billetera.</li>
          <li className="flex gap-2"><span aria-hidden className="font-black text-rose-600">✕</span>No podrá ver tus movimientos ni tus datos personales.</li>
          <li className="flex gap-2"><span aria-hidden className="font-black text-muted-foreground">↺</span>Puedes retirar el acceso cuando quieras desde tu perfil.</li>
        </ul>

        {state === 'done' ? (
          <p className="mt-6 text-center text-sm font-semibold text-foreground" role="status">
            Volviendo a {props.merchantName}…
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {blockedReason && (
              <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-foreground">{blockedReason}</p>
            )}
            {error && <p className="text-sm font-semibold text-destructive" role="alert">{error}</p>}

            <Button
              type="button"
              variant="brand"
              size="xl"
              className="w-full"
              disabled={state === 'submitting' || Boolean(blockedReason)}
              onClick={() => decide('approve')}
            >
              {state === 'submitting' ? 'Procesando…' : 'Autorizar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={state === 'submitting' || props.isOwnRequest}
              onClick={() => decide('deny')}
            >
              Rechazar
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Este enlace caduca el {new Date(props.expiresAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Link href="/dashboard" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Ir a mi billetera FondosEG
          </Link>
        </div>
      </div>
    </main>
  );
}
