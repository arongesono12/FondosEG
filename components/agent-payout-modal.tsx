'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { Transfer } from '@/types';
import { AlertCircle, CheckCircle2, HandCoins, Loader2, Search } from 'lucide-react';

interface AgentPayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AgentPayoutModal({ open, onOpenChange, onSuccess }: AgentPayoutModalProps) {
  const [code, setCode] = useState('');
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode('');
      setTransfer(null);
      setError('');
      setSuccess(false);
      setLoading(false);
      setConfirming(false);
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
      const res = await fetch(`/api/transfers/lookup?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se encontró la transferencia');
        return;
      }
      setTransfer(data);
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handlePayout = async () => {
    if (!transfer) return;
    setConfirming(true);
    setError('');
    try {
      const res = await fetch('/api/transfers/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfer_id: transfer.id }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'No se pudo completar el pago');
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden outline-none">
        {!success ? (
          <>
            <DialogHeader className="p-6 border-b border-border/10">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
                <HandCoins className="h-5 w-5 text-primary" />
                Pagar transferencia
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Busca la transferencia con el código de retiro y confirma el pago.
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Código de retiro</label>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="TRX-2026-000000"
                    className="h-12 rounded-xl font-black tracking-[0.22em]"
                  />
                  <Button variant="outline" className="rounded-xl font-black" onClick={handleLookup} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {transfer && (
                <div className="rounded-2xl border border-border/10 bg-background/70 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-foreground">{transfer.receiver_name}</p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {transfer.sender_name} · {transfer.destination_city}
                      </p>
                    </div>
                    <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      Disponible
                    </Badge>
                  </div>
                  <p className="mt-3 text-2xl font-black text-foreground">
                    {formatCurrency(transfer.amount, transfer.currency)}
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                className="w-full rounded-xl bg-brand-gradient text-white font-black"
                onClick={handlePayout}
                disabled={!transfer || confirming}
              >
                {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar pago'}
              </Button>
            </div>
          </>
        ) : (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-black">Pago confirmado</p>
              <p className="text-sm text-muted-foreground mt-1">
                La transferencia fue pagada y tu saldo digital ha sido actualizado.
              </p>
            </div>
            <Button className="w-full rounded-xl bg-brand-gradient text-white font-black" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
