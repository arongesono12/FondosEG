'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Landmark, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createRevolutPayoutForTransfer } from '@/services/transfer';
import type { Transfer } from '@/types';
import { formatCurrency, getStatusColor, getStatusText } from '@/lib/utils';

interface RevolutPayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RevolutPayoutModal({ open, onOpenChange, onSuccess }: RevolutPayoutModalProps) {
  const [code, setCode] = useState('');
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setCode('');
      setTransfer(null);
      setLoading(false);
      setCreating(false);
      setError('');
    }
  }, [open]);

  const handleLookup = async () => {
    if (!code.trim()) {
      setError('Ingresa el código de la transferencia');
      return;
    }

    setLoading(true);
    setError('');
    setTransfer(null);

    try {
      const response = await fetch(`/api/transfers/lookup?code=${encodeURIComponent(code.trim())}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'No se encontró la transferencia');
        return;
      }
      setTransfer(data as Transfer);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayout = async () => {
    if (!transfer) return;

    setCreating(true);
    setError('');

    try {
      const result = await createRevolutPayoutForTransfer(transfer.id);
      if (!result.success || !result.transfer) {
        setError(result.error || 'No se pudo generar el payout link de Revolut');
        return;
      }
      setTransfer(result.transfer);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setCreating(false);
    }
  };

  const hasPayoutLink = Boolean(transfer?.payout_provider === 'revolut' && transfer.payout_url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden outline-none">
        <DialogHeader className="border-b border-border/10 p-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Landmark className="h-5 w-5 text-primary" />
            Payout por Revolut
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Genera un enlace para que el destinatario reclame el dinero fuera de la red de gestores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Código de transferencia</label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="TRX-2026-000000"
                className="h-12 rounded-xl font-bold tracking-[0.18em]"
              />
              <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={handleLookup} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {transfer && (
            <div className="space-y-4 rounded-2xl border border-border/10 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-black text-foreground">{transfer.transfer_code}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {transfer.receiver_name} · {transfer.destination_city}
                  </p>
                </div>
                <Badge className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${getStatusColor(transfer.status)}`}>
                  {getStatusText(transfer.status)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Monto</p>
                  <p className="font-black text-foreground">{formatCurrency(transfer.amount, transfer.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Canal</p>
                  <p className="font-black text-foreground">{transfer.payout_provider === 'revolut' ? 'Revolut' : 'Gestor'}</p>
                </div>
              </div>

              {hasPayoutLink ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Enlace Revolut generado
                  </div>
                  <Button asChild className="mt-3 h-10 w-full rounded-xl font-bold">
                    <a href={transfer.payout_url} target="_blank" rel="noreferrer">
                      Abrir enlace <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ) : (
                <Button onClick={handleCreatePayout} disabled={creating} className="h-12 w-full rounded-xl font-bold">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Landmark className="h-4 w-4" />
                      Generar payout link
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
