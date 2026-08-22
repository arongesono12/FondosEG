'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Wallet, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Check,
  Copy,
  QrCode,
} from 'lucide-react';
import { QRGenerator, generateQRData } from '@/components/ui/qr-generator';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import type { WalletTransfer } from '@/types';
import { PAYMENT_REGULATION } from '@/lib/compliance';

interface WalletTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'form' | 'qr' | 'success';

export function WalletTransferModal({ open, onOpenChange, onSuccess }: WalletTransferModalProps) {
  const { user } = useAppStore();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [transfer, setTransfer] = useState<WalletTransfer | null>(null);
  const [balance, setBalance] = useState(0);
  const [complianceConsent, setComplianceConsent] = useState(false);
  const [copied, setCopied] = useState(false);
  // La billetera opera en su propia divisa, que se lee del saldo real. La
  // preferencia de visualización del usuario no puede decidir la divisa de la
  // operación: no hay conversión en ninguna capa, así que usarla mostraba saldo
  // 0 y bloqueaba el envío con "Saldo insuficiente" teniendo fondos de sobra.
  const [currency, setCurrency] = useState('XAF');

  useEffect(() => {
    if (!open) {
      setStep('form');
      setReceiverPhone('');
      setReceiverName('');
      setAmount('');
      setNotes('');
      setTransfer(null);
      setError(null);
      setComplianceConsent(false);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    async function fetchBalance() {
      if (!user) return;
      try {
        const res = await fetch(`/api/balance?userId=${user.id}`);
        if (!res.ok) {
          setError('No se pudo consultar tu saldo disponible');
          return;
        }
        const data = await res.json();
        // `client_balances.client_id` es UNIQUE: hay como mucho una fila de
        // saldo por cliente, y es ella la que fija la divisa de la billetera.
        const wallet = Array.isArray(data.balances) ? data.balances[0] : null;
        setBalance(Number(wallet?.balance) || 0);
        setCurrency(wallet?.currency || 'XAF');
      } catch (err) {
        console.error('Error fetching balance:', err);
      }
    }
    fetchBalance();
  }, [user]);

  const handleSubmit = async () => {
    if (!receiverPhone || !receiverName || !amount) {
      setError('Por favor complete todos los campos');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Monto inválido');
      return;
    }

    if (numAmount > balance) {
      setError('Saldo insuficiente');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wallet-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          receiver_phone: receiverPhone,
          receiver_name: receiverName,
          amount: numAmount,
          currency,
          notes,
          compliance_consent: complianceConsent,
          disclosure_version: PAYMENT_REGULATION.disclosureVersion,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Error al crear la transferencia');
        return;
      }

      setTransfer(data.transfer);
      setStep('qr');
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!transfer) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          transfer_id: transfer.id,
        }),
      });

      const data = await res.json();

      // Cerrar el diálogo pase lo que pase daba por anulada una orden que seguía
      // viva y cobrable durante 24 horas.
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo cancelar la transferencia');
        return;
      }

      onOpenChange(false);
    } catch (err) {
      console.error('Error cancelling:', err);
      setError('Error de conexión al cancelar la transferencia');
    } finally {
      setLoading(false);
    }
  };

  // El código sólo viaja en la respuesta de creación, que va dirigida al emisor.
  // Los listados lo omiten para que el beneficiario no pueda leerlo, así que el
  // tipo lo declara opcional.
  const verificationCode = transfer?.verification_code ?? '';

  const copyCode = async () => {
    if (!verificationCode) return;
    try {
      await navigator.clipboard.writeText(verificationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar el código. Cópialo manualmente.');
    }
  };

  const qrData = transfer ? generateQRData({
    transfer_id: transfer.id,
    amount: transfer.amount,
    currency: transfer.currency,
    sender_name: transfer.sender_name,
    receiver_name: transfer.receiver_name,
    verification_code: verificationCode,
  }) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden outline-none">
        {step === 'form' && (
          <>
            <DialogHeader className="p-6 border-b border-border/10">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Wallet className="h-5 w-5 text-primary" />
                Transferir a Cliente
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Transfiere fondos de tu billetera a otro cliente sin comisión
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                  Saldo disponible: {formatCurrency(balance, currency)}
                </p>
                <p className="text-[10px] text-green-500 mt-1">
                  Sin comisión para transferencias entre clientes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiverPhone">Teléfono del destinatario</Label>
                <Input
                  id="receiverPhone"
                  placeholder="+240 XXX XXX XXX"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiverName">Nombre del destinatario</Label>
                <Input
                  id="receiverName"
                  placeholder="Nombre completo"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Monto a transferir</Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Mensaje opcional para el destinatario"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                  Información previa
                </p>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-muted-foreground">
                  <p>Importe: {formatCurrency(Number(amount) || 0, currency)}</p>
                  <p>Comisión: {formatCurrency(0, currency)}</p>
                  <p>Beneficiario: {receiverName || 'Pendiente de completar'}</p>
                  <p>Plazo: pendiente de confirmación del beneficiario, con vigencia máxima de 24 horas.</p>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={complianceConsent}
                    onChange={(event) => setComplianceConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-pink-600"
                  />
                  <span>
                    Autorizo esta orden de pago y acepto la información previa conforme al Reglamento{' '}
                    {PAYMENT_REGULATION.code}.
                  </span>
                </label>
              </div>

              <Button 
                onClick={handleSubmit}
                disabled={loading || !receiverPhone || !receiverName || !amount || !complianceConsent}
                className="w-full h-12 rounded-xl bg-brand-gradient text-white font-bold shadow-lg shadow-pink-500/20"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" /> Crear Transferencia
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {step === 'qr' && transfer && (
          <>
            <DialogHeader className="p-6 border-b border-border/10">
               <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <QrCode className="h-5 w-5 text-primary" />
                Comparte el QR
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                El destinatario debe escanear este QR e ingresar el código para confirmar
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">
                  Monto a recibir
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(transfer.amount, transfer.currency)}
                </p>
              </div>

              <QRGenerator data={qrData} size={200} />

              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Código de verificación
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold tracking-[0.5em]">
                    {verificationCode}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyCode}
                    aria-label={copied ? 'Código copiado' : 'Copiar código de verificación'}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-500 text-center">
                  Entrégalo únicamente al destinatario: quien tenga este código
                  puede cobrar la transferencia.
                </p>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    setStep('success');
                    onSuccess?.();
                  }}
                   className="flex-1 bg-brand-gradient text-white font-bold"
                >
                  Listo
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'success' && transfer && (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
               <p className="text-lg font-bold">Transferencia creada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Hemos avisado al destinatario. Entrégale el código de
                confirmación para que pueda cobrarla.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monto:</span>
                <span className="font-semibold">{formatCurrency(transfer.amount, transfer.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Para:</span>
                <span className="font-semibold">{transfer.receiver_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estado:</span>
                <span className="font-semibold text-amber-600">Pendiente de confirmación</span>
              </div>
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
