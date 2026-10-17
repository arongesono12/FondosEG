'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PAYMENT_REGULATION } from '@/lib/compliance';
import { buildCheckoutReturnUrl, type PaymentRequestStatus } from '@/lib/server/payment-requests-contract';
import { formatCurrency } from '@/lib/utils';

interface PaymentRequestCheckoutProps {
  requestId: string;
  merchantName: string;
  amount: number;
  currency: string;
  description: string | null;
  reference: string;
  /** Referencia del integrador (su id de orden); viaja de vuelta en la URL. */
  externalReference: string;
  status: PaymentRequestStatus;
  expiresAt: string;
  returnUrl: string | null;
  isOwnRequest: boolean;
  availableBalance: number;
  walletCurrency: string;
}

type CheckoutState = PaymentRequestStatus | 'submitting';

/** Segundos que se muestra el resultado antes de volver a la app del comercio. */
const RETURN_DELAY_SECONDS = 4;

const FINAL_MESSAGES: Record<Exclude<PaymentRequestStatus, 'pending'>, { title: string; description: string }> = {
  paid: { title: 'Pago completado', description: 'El importe se descontó de tu billetera y el comercio ya ha sido avisado.' },
  cancelled: { title: 'Solicitud rechazada', description: 'No se ha cobrado nada. Puedes volver a la aplicación del comercio.' },
  expired: { title: 'Solicitud caducada', description: 'Este enlace ya no admite pagos. Inicia el pago de nuevo desde la aplicación del comercio.' },
};

export function PaymentRequestCheckout(props: PaymentRequestCheckoutProps) {
  const [state, setState] = useState<CheckoutState>(props.status);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  const insufficientBalance = props.availableBalance < props.amount;
  const currencyMismatch = props.walletCurrency !== props.currency;
  const blockedReason = props.isOwnRequest
    ? 'No puedes pagar una solicitud de cobro de tu propia billetera.'
    : currencyMismatch
      ? `Tu billetera opera en ${props.walletCurrency} y esta solicitud está en ${props.currency}.`
      : insufficientBalance
        ? 'No tienes saldo suficiente. Recarga tu billetera y vuelve a abrir este enlace.'
        : null;

  async function submit(action: 'pay' | 'decline') {
    setState('submitting');
    setError(null);
    try {
      const response = await fetch(`/api/payment-requests/${encodeURIComponent(props.requestId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'pay'
            ? { action, compliance_consent: true, disclosure_version: PAYMENT_REGULATION.disclosureVersion }
            : { action }
        ),
      });
      const result = (await response.json().catch(() => ({}))) as { status?: PaymentRequestStatus; error?: string };
      if (!response.ok || !result.status) {
        setError(result.error || 'No se pudo completar la operación. Inténtalo de nuevo.');
        setState('pending');
        return;
      }
      setState(result.status);
    } catch {
      setError('Sin conexión. Comprueba tu red e inténtalo de nuevo.');
      setState('pending');
    }
  }

  const isFinal = state === 'paid' || state === 'cancelled' || state === 'expired';
  const returnHref = isFinal && props.returnUrl
    ? buildCheckoutReturnUrl(props.returnUrl, state, props.externalReference)
    : null;
  const [secondsLeft, setSecondsLeft] = useState(RETURN_DELAY_SECONDS);

  // Vuelve sola a la app del comercio para que muestre el resultado. La
  // cuenta atrás deja leer la confirmación y el enlace cubre el caso de que el
  // navegador bloquee la redirección.
  useEffect(() => {
    if (!returnHref) return;
    if (secondsLeft <= 0) {
      window.location.assign(returnHref);
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [returnHref, secondsLeft]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="app-card w-full max-w-md p-6 sm:p-8">
        <DashboardLogo size="lg" className="justify-center mb-6" iconClassName="h-12 w-12 rounded-full" labelClassName="text-3xl" />

        <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Solicitud de pago</p>
        <h1 className="mt-2 text-center text-xl font-black text-foreground">{props.merchantName}</h1>
        <p className="mt-4 text-center text-4xl font-black tracking-tight text-foreground">
          {formatCurrency(props.amount, props.currency)}
        </p>

        <dl className="mt-6 space-y-2 rounded-2xl border border-border/30 bg-muted/30 p-4 text-sm">
          {props.description && (
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Concepto</dt><dd className="text-right font-semibold text-foreground">{props.description}</dd></div>
          )}
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Referencia</dt><dd className="break-all text-right font-mono text-xs font-semibold text-foreground">{props.reference}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tu saldo disponible</dt><dd className="text-right font-semibold text-foreground">{formatCurrency(props.availableBalance, props.walletCurrency)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Comisión</dt><dd className="text-right font-semibold text-foreground">{formatCurrency(0, props.currency)}</dd></div>
        </dl>

        {isFinal ? (
          <div className="mt-6 text-center" role="status">
            <p className="text-lg font-black text-foreground">{FINAL_MESSAGES[state].title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{FINAL_MESSAGES[state].description}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {blockedReason ? (
              <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-foreground">{blockedReason}</p>
            ) : (
              <label className="flex cursor-pointer items-start gap-3 text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-pink-600"
                />
                <span>
                  Autorizo este pago desde mi billetera y acepto la información previa conforme al Reglamento{' '}
                  {PAYMENT_REGULATION.code}.
                </span>
              </label>
            )}

            {error && <p className="text-sm font-semibold text-destructive" role="alert">{error}</p>}

            <Button
              type="button"
              variant="brand"
              size="xl"
              className="w-full"
              disabled={state === 'submitting' || !consent || Boolean(blockedReason)}
              onClick={() => submit('pay')}
            >
              {state === 'submitting' ? 'Procesando…' : `Pagar ${formatCurrency(props.amount, props.currency)}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={state === 'submitting' || props.isOwnRequest}
              onClick={() => setConfirmDecline(true)}
            >
              Rechazar solicitud
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Caduca el {new Date(props.expiresAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2">
          {returnHref && (
            <>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Volviendo a {props.merchantName} en {Math.max(secondsLeft, 0)} s…
              </p>
              <a href={returnHref} className="text-sm font-bold text-primary underline-offset-4 hover:underline">
                Volver ahora a {props.merchantName}
              </a>
            </>
          )}
          <Link href="/dashboard" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Ir a mi billetera FondosEG
          </Link>
        </div>
      </div>
      <Dialog open={confirmDecline} onOpenChange={setConfirmDecline}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>¿Rechazar esta solicitud?</DialogTitle>
            <DialogDescription>Vas a rechazar la solicitud de {props.merchantName} por {formatCurrency(props.amount, props.currency)}. No se cobrará nada.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">Revisa el comercio y el importe antes de continuar.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDecline(false)}>Volver</Button>
            <Button type="button" variant="destructive" onClick={() => { setConfirmDecline(false); void submit('decline'); }}>Confirmar rechazo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
