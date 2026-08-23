'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Banknote,
  Check,
  Copy,
  HandCoins,
  Loader2,
  QrCode,
} from 'lucide-react';
import { QRGenerator, generateWithdrawalQRData } from '@/components/ui/qr-generator';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CLIENT_WITHDRAWAL_EXPIRY_HOURS,
  getAvailableClientBalance,
  getWithdrawalStatusLabel,
} from '@/lib/financial';
import type { ClientWithdrawal } from '@/types';

interface ClientWithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'form' | 'code';

/**
 * Emisión del código de retiro por parte del titular del saldo.
 *
 * El cliente no depende del código que generó el gestor al enviarle dinero: el
 * saldo ya es suyo y aquí decide cuánto quiere en efectivo. Mientras el vale
 * está vivo, el importe queda retenido para que no pueda gastarse dos veces.
 */
export function ClientWithdrawalModal({ open, onOpenChange, onSuccess }: ClientWithdrawalModalProps) {
  const { user } = useAppStore();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [notes, setNotes] = useState('');
  const [available, setAvailable] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [currency, setCurrency] = useState('XAF');
  const [withdrawal, setWithdrawal] = useState<ClientWithdrawal | null>(null);
  const [activeWithdrawals, setActiveWithdrawals] = useState<ClientWithdrawal[]>([]);
  const [copied, setCopied] = useState(false);

  const loadState = useCallback(async () => {
    if (!user) return;
    try {
      // El listado libera antes las retenciones caducadas, así que se consulta
      // primero: de lo contrario el saldo mostrado seguiría descontando vales
      // que ya no existen.
      const withdrawalsRes = await fetch('/api/withdrawals');
      if (withdrawalsRes.ok) {
        const data = (await withdrawalsRes.json()) as ClientWithdrawal[];
        setActiveWithdrawals(data.filter((item) => item.status === 'pending'));
      }

      const balanceRes = await fetch(`/api/balance?userId=${encodeURIComponent(user.id)}`);
      if (!balanceRes.ok) {
        setError('No se pudo consultar tu saldo disponible');
        return;
      }
      const balanceData = await balanceRes.json();
      const wallet = Array.isArray(balanceData.balances) ? balanceData.balances[0] : null;
      setAvailable(
        getAvailableClientBalance(Number(wallet?.balance) || 0, Number(wallet?.reserved_balance) || 0)
      );
      setReserved(Number(wallet?.reserved_balance) || 0);
      setCurrency(wallet?.currency || 'XAF');
    } catch (err) {
      console.error('Error cargando el estado de la billetera:', err);
      setError('Error de conexión al consultar tu billetera');
    }
  }, [user]);

  useEffect(() => {
    if (!open) {
      setStep('form');
      setAmount('');
      setDestinationCity('');
      setNotes('');
      setWithdrawal(null);
      setError(null);
      setCopied(false);
      return;
    }
    loadState();
  }, [open, loadState]);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Monto inválido');
      return;
    }

    if (numAmount > available) {
      setError('Saldo disponible insuficiente');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          amount: numAmount,
          currency,
          destination_city: destinationCity || undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo generar el código de retiro');
        return;
      }

      setWithdrawal(data.withdrawal);
      setStep('code');
      await loadState();
      onSuccess?.();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (withdrawalId: string) => {
    setCancellingId(withdrawalId);
    setError(null);
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', withdrawal_id: withdrawalId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo anular el retiro');
        return;
      }

      if (withdrawal?.id === withdrawalId) {
        setWithdrawal(null);
        setStep('form');
      }
      await loadState();
      onSuccess?.();
    } catch {
      setError('Error de conexión al anular el retiro');
    } finally {
      setCancellingId(null);
    }
  };

  const copyCode = async () => {
    if (!withdrawal) return;
    try {
      await navigator.clipboard.writeText(withdrawal.withdrawal_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar el código. Cópialo manualmente.');
    }
  };

  const qrData = withdrawal
    ? generateWithdrawalQRData({
        withdrawal_id: withdrawal.id,
        withdrawal_code: withdrawal.withdrawal_code,
        amount: Number(withdrawal.amount),
        currency: withdrawal.currency,
        client_name: user?.name || '',
        expires_at: withdrawal.expires_at,
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden outline-none">
        {step === 'form' && (
          <>
            <DialogHeader className="p-6 border-b border-border/10">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <HandCoins className="h-5 w-5 text-primary" />
                Retirar efectivo
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Genera tu propio código y preséntalo con tu DIP en cualquier gestor autorizado.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Saldo disponible: {formatCurrency(available, currency)}
                </p>
                <p className="mt-1 text-[10px] text-emerald-500">
                  {reserved > 0
                    ? `${formatCurrency(reserved, currency)} retenidos por códigos u órdenes en curso`
                    : 'Tu saldo se retiene sólo mientras un código de retiro está activo'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawal-amount">Monto a retirar</Label>
                <Input
                  id="withdrawal-amount"
                  type="number"
                  inputMode="decimal"
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawal-city">Ciudad donde vas a retirar (opcional)</Label>
                <Input
                  id="withdrawal-city"
                  placeholder="Malabo, Bata..."
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawal-notes">Notas (opcional)</Label>
                <Textarea
                  id="withdrawal-notes"
                  placeholder="Referencia para ti"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                  Cómo funciona
                </p>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-muted-foreground">
                  <p>El importe queda retenido en tu billetera hasta que retires o anules el código.</p>
                  <p>Vigencia del código: {CLIENT_WITHDRAWAL_EXPIRY_HOURS} horas.</p>
                  <p>Debes presentar tu DIP al gestor: el código por sí solo no identifica al titular.</p>
                </div>
              </div>

              {activeWithdrawals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Códigos activos
                  </p>
                  {activeWithdrawals.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/10 bg-background/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-bold tracking-[0.12em] text-foreground">
                          {item.withdrawal_code}
                        </p>
                        <p className="text-[10px] font-semibold text-muted-foreground">
                          {formatCurrency(Number(item.amount), item.currency)}
                          {item.expires_at ? ` · caduca ${formatDate(item.expires_at)}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs font-bold"
                        disabled={cancellingId === item.id}
                        onClick={() => handleCancel(item.id)}
                      >
                        {cancellingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Anular'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={loading || !amount}
                className="h-12 w-full rounded-xl bg-brand-gradient font-bold text-white shadow-lg shadow-pink-500/20"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Banknote className="mr-2 h-4 w-4" /> Generar código de retiro
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {step === 'code' && withdrawal && (
          <>
            <DialogHeader className="p-6 border-b border-border/10">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <QrCode className="h-5 w-5 text-primary" />
                Tu código de retiro
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Preséntalo con tu DIP en el gestor donde quieras cobrar.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
              <div className="space-y-2 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Importe a recibir</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(Number(withdrawal.amount), withdrawal.currency)}
                </p>
                <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  {getWithdrawalStatusLabel(withdrawal.status)}
                </Badge>
              </div>

              <QRGenerator data={qrData} size={200} />

              <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Código de retiro
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold tracking-[0.2em]">{withdrawal.withdrawal_code}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyCode}
                    aria-label={copied ? 'Código copiado' : 'Copiar código de retiro'}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {withdrawal.expires_at && (
                  <p className="text-[10px] font-semibold text-muted-foreground">
                    Válido hasta {formatDate(withdrawal.expires_at)}
                  </p>
                )}
                <p className="text-center text-[10px] text-amber-600 dark:text-amber-500">
                  Mientras el código esté activo, este importe queda retenido y no podrás usarlo
                  para otras operaciones.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={cancellingId === withdrawal.id}
                  onClick={() => handleCancel(withdrawal.id)}
                >
                  {cancellingId === withdrawal.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Anular retiro'
                  )}
                </Button>
                <Button
                  className="flex-1 bg-brand-gradient font-bold text-white"
                  onClick={() => onOpenChange(false)}
                >
                  Listo
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
