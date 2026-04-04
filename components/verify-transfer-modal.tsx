'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  QrCode, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ArrowRightLeft,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import type { WalletTransfer } from '@/types';

interface VerifyTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VerifyTransferModal({ open, onOpenChange, onSuccess }: VerifyTransferModalProps) {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [transfer, setTransfer] = useState<WalletTransfer | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<WalletTransfer[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setVerificationCode('');
      setTransfer(null);
      setSuccess(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    async function fetchPendingTransfers() {
      if (!user || !open) return;
      try {
        const res = await fetch('/api/wallet-transfer?type=pending');
        const data = await res.json();
        setPendingTransfers(data || []);
      } catch (err) {
        console.error('Error fetching pending:', err);
      }
    }
    fetchPendingTransfers();
  }, [user, open]);

  const handleVerify = useCallback(async () => {
    if (verificationCode.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wallet-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          verification_code: verificationCode,
          transfer_id: transfer?.id,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Error al confirmar');
        return;
      }

      setSuccess(true);
      onSuccess?.();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [verificationCode, transfer, onSuccess]);

  useEffect(() => {
    if (verificationCode.length === 6 && !transfer) {
      handleVerify();
    }
  }, [verificationCode, transfer, handleVerify]);

  const handleSelectTransfer = (t: WalletTransfer) => {
    setTransfer(t);
    setVerificationCode('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden outline-none">
        {!transfer && !success && (
          <>
            <DialogHeader className="p-6 border-b border-border/10">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Transferencias Pendientes
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Selecciona una transferencia para confirmar
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {pendingTransfers.length === 0 ? (
                <div className="text-center py-8">
                  <QrCode className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground mt-2">
                    No hay transferencias pendientes
                  </p>
                </div>
              ) : (
                pendingTransfers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTransfer(t)}
                    className="w-full p-4 rounded-xl border border-border/20 bg-card hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{t.sender_name}</p>
                        <p className="text-xs text-muted-foreground">{t.sender_phone}</p>
                      </div>
                      <p className="text-lg font-bold text-green-600">
                        +{formatCurrency(t.amount, t.currency)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {transfer && !success && (
          <>
            <DialogHeader className="p-6 border-b border-border/10">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <QrCode className="h-5 w-5 text-primary" />
                Confirmar Transferencia
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Ingresa el código de 6 dígitos para confirmar
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">
                  Recibirás
                </p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {formatCurrency(transfer.amount, transfer.currency)}
                </p>
                <p className="text-xs text-green-500 mt-2">
                  de {transfer.sender_name}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Código de verificación</Label>
                <Input
                  ref={inputRef}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ingresa los 6 dígitos"
                  className="text-center text-2xl font-bold tracking-[0.5em] h-14"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setTransfer(null);
                    setVerificationCode('');
                  }}
                  className="flex-1"
                >
                  Atrás
                </Button>
                <Button 
                  onClick={handleVerify}
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1 bg-brand-gradient text-white font-bold"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {success && (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold">¡Transferencia confirmada!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Los fondos han sido añadidos a tu billetera
              </p>
            </div>
            <Button 
              onClick={() => onOpenChange(false)}
              className="w-full bg-brand-gradient text-white font-bold"
            >
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-semibold text-foreground">
      {children}
    </label>
  );
}
