'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PanelSkeleton } from '@/components/skeletons/app-skeletons';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { ClientWithdrawal, Transfer } from '@/types';
import { AlertCircle, CheckCircle2, HandCoins, Loader2, Search, Wallet } from '@/components/ui/hugeicons';

interface AgentPayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Un gestor puede pagar dos cosas distintas con el mismo mostrador:
 *
 *   * `transfer`: un envío de ventanilla para un beneficiario SIN cuenta. El
 *     código lo generó el gestor emisor.
 *   * `withdrawal`: un retiro contra la billetera de un cliente registrado. El
 *     código lo generó el propio titular desde su panel.
 *
 * Los envíos ya acreditados a una cuenta no aparecen aquí: nacen liquidados y
 * su código de envío no autoriza ninguna entrega de efectivo.
 */
type PayoutTarget =
  | { kind: 'transfer'; transfer: Transfer }
  | { kind: 'withdrawal'; withdrawal: ClientWithdrawal };

export function AgentPayoutModal({ open, onOpenChange, onSuccess }: AgentPayoutModalProps) {
  const [code, setCode] = useState('');
  const [target, setTarget] = useState<PayoutTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode('');
      setTarget(null);
      setError('');
      setSuccess(false);
      setLoading(false);
      setConfirming(false);
    }
  }, [open]);

  const lookupWithdrawal = async (normalizedCode: string): Promise<PayoutTarget | string> => {
    const res = await fetch(`/api/withdrawals/lookup?code=${encodeURIComponent(normalizedCode)}`);
    const data = await res.json();
    if (!res.ok) return data.error || 'No se encontró el retiro';
    return { kind: 'withdrawal', withdrawal: data as ClientWithdrawal };
  };

  const lookupTransfer = async (normalizedCode: string): Promise<PayoutTarget | string> => {
    const res = await fetch(`/api/transfers/lookup?code=${encodeURIComponent(normalizedCode)}`);
    const data = await res.json();
    if (!res.ok) return data.error || 'No se encontró la transferencia';
    return { kind: 'transfer', transfer: data as Transfer };
  };

  const handleLookup = async () => {
    // Con el <form>, Intro lanza la búsqueda: mientras se confirma un pago
    // no puede vaciar el objetivo ni cambiar el tipo de operación en curso.
    if (loading || confirming) return;
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError('Ingresa el código de retiro o de envío');
      return;
    }

    setLoading(true);
    setError('');
    setTarget(null);

    try {
      // El prefijo distingue el flujo, pero si no encaja se prueba el otro: un
      // gestor no tiene por qué saber de qué tipo es el código que le enseñan.
      const isWithdrawalCode = normalized.startsWith('RET-');
      const primary = isWithdrawalCode
        ? await lookupWithdrawal(normalized)
        : await lookupTransfer(normalized);

      if (typeof primary !== 'string') {
        setTarget(primary);
        return;
      }

      const fallback = isWithdrawalCode
        ? await lookupTransfer(normalized)
        : await lookupWithdrawal(normalized);

      if (typeof fallback !== 'string') {
        setTarget(fallback);
        return;
      }

      setError(primary);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handlePayout = async () => {
    if (!target) return;
    setConfirming(true);
    setError('');
    try {
      const endpoint =
        target.kind === 'withdrawal' ? '/api/withdrawals/payout' : '/api/transfers/payout';
      const body =
        target.kind === 'withdrawal'
          ? { withdrawal_id: target.withdrawal.id }
          : { transfer_id: target.transfer.id };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'No se pudo completar el pago');
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch {
      setError('Error de conexión');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="outline-none">
        {!success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <HandCoins className="h-5 w-5 text-primary" />
                Pagar en efectivo
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Busca el envío de ventanilla o el retiro de billetera y confirma la entrega.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {/* Un <form> para que Intro lance la búsqueda, como en cualquier
                  buscador. El marcador corto cabe en 320px; el formato completo
                  va en la línea de ayuda. */}
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleLookup();
                }}
              >
                <label htmlFor="payout-code" className="text-xs font-semibold text-muted-foreground">Código de retiro o envío</label>
                <div className="flex gap-2">
                  <Input
                    id="payout-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="TRX-… o RET-…"
                    enterKeyHint="search"
                    aria-describedby="payout-code-hint"
                    className="h-12 min-w-0 rounded-xl font-bold tracking-[0.08em] @sm:tracking-[0.18em]"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    aria-label="Buscar código"
                    className="size-12 shrink-0 rounded-xl font-bold"
                    disabled={loading || confirming}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                <p id="payout-code-hint" className="text-xs text-muted-foreground">
                  Formato: TRX-2026-000000 o RET-2026-000000
                </p>
              </form>

              {loading && !target && !error && (
                <PanelSkeleton rows={2} className="rounded-2xl border border-border/10 bg-background/70 p-4" />
              )}

              {target?.kind === 'transfer' && (
                <div className="rounded-2xl border border-border/10 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground wrap-break-word">{target.transfer.receiver_name}</p>
                      <p className="text-xs font-semibold text-muted-foreground wrap-break-word">
                        {target.transfer.sender_name} · {target.transfer.destination_city}
                      </p>
                    </div>
                    <Badge className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                      Envío
                    </Badge>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-foreground">
                    {formatCurrency(target.transfer.amount, target.transfer.currency)}
                  </p>
                </div>
              )}

              {target?.kind === 'withdrawal' && (
                <div className="rounded-2xl border border-border/10 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground wrap-break-word">
                        {target.withdrawal.client?.name || 'Cliente registrado'}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground wrap-break-word">
                        {target.withdrawal.client?.document_type || 'DIP'}
                        {target.withdrawal.client?.document_number
                          ? `: ${target.withdrawal.client.document_number}`
                          : ' no registrado en el perfil'}
                      </p>
                      {target.withdrawal.expires_at && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Válido hasta {formatDate(target.withdrawal.expires_at)}
                        </p>
                      )}
                    </div>
                    <Badge className="shrink-0 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
                      Retiro
                    </Badge>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-foreground">
                    {formatCurrency(Number(target.withdrawal.amount), target.withdrawal.currency)}
                  </p>
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Comprueba el DIP del titular antes de entregar el efectivo: el importe se
                    descuenta de su billetera.
                  </div>
                </div>
              )}

              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                className="w-full rounded-xl bg-brand-gradient text-white font-bold"
                onClick={handlePayout}
                disabled={!target || confirming}
              >
                {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar pago'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Resultado sin detalle: sólo cabecera y pie, sin cuerpo. */}
            <DialogHeader align="center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <DialogTitle className="text-lg font-bold">Pago confirmado</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {target?.kind === 'withdrawal'
                  ? 'El retiro fue entregado y tu saldo digital ha sido actualizado.'
                  : 'La transferencia fue pagada y tu saldo digital ha sido actualizado.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="brand" className="w-full rounded-xl font-bold" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
