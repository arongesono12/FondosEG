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
  Copy,
  QrCode,
} from 'lucide-react';
import { QRGenerator, generateQRData } from '@/components/ui/qr-generator';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import type { WalletTransfer } from '@/types';

interface WalletTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'form' | 'qr' | 'success';

export function WalletTransferModal({ open, onOpenChange, onSuccess }: WalletTransferModalProps) {
  const { user, preferredCurrency } = useAppStore();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [transfer, setTransfer] = useState<WalletTransfer | null>(null);
  const [balance, setBalance] = useState(0);

  const currency = preferredCurrency || 'XAF';

  useEffect(() => {
    if (!open) {
      setStep('form');
      setReceiverPhone('');
      setReceiverName('');
      setAmount('');
      setNotes('');
      setTransfer(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    async function fetchBalance() {
      if (!user) return;
      try {
        const res = await fetch(`/api/balance?userId=${user.id}`);
        const data = await res.json();
        const bal = data.balances?.find((b: any) => b.currency === currency);
        setBalance(bal?.balance || 0);
      } catch (err) {
        console.error('Error fetching balance:', err);
      }
    }
    fetchBalance();
  }, [user, currency]);

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
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Error al crear la transferencia');
        return;
      }

      setTransfer(data.transfer);
      setStep('qr');
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!transfer) return;

    setLoading(true);
    try {
      await fetch('/api/wallet-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          transfer_id: transfer.id,
        }),
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Error cancelling:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (transfer) {
      navigator.clipboard.writeText(transfer.verification_code);
    }
  };

  const qrData = transfer ? generateQRData({
    transfer_id: transfer.id,
    amount: transfer.amount,
    currency: transfer.currency,
    sender_name: transfer.sender_name,
    receiver_name: transfer.receiver_name,
    verification_code: transfer.verification_code,
  }) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden outline-none">
        {step === 'form' && (
          <>
            <DialogHeader className="p-6 border-b border-border/10">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
                <Wallet className="h-5 w-5 text-primary" />
                Transferir a Cliente
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Transfiere fondos de tu billetera a otro cliente sin comisión
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-xs font-bold text-green-600 dark:text-green-400">
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
                  placeholder="+237 6XX XXX XXX"
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

              <Button 
                onClick={handleSubmit}
                disabled={loading || !receiverPhone || !receiverName || !amount}
                className="w-full h-12 rounded-xl bg-brand-gradient text-white font-black shadow-lg shadow-pink-500/20"
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
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
                <QrCode className="h-5 w-5 text-primary" />
                Comparte el QR
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                El destinatario debe escanear este QR e ingresar el código para confirmar
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-muted-foreground">
                  Monto a recibir
                </p>
                <p className="text-3xl font-black text-green-600">
                  {formatCurrency(transfer.amount, transfer.currency)}
                </p>
              </div>

              <QRGenerator data={qrData} size={200} />

              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50">
                <p className="text-xs font-bold text-muted-foreground uppercase">
                  Código de verificación
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-black tracking-[0.5em]">
                    {transfer.verification_code}
                  </p>
                  <Button variant="ghost" size="icon" onClick={copyCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Comparte este código con el destinatario
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
                  className="flex-1 bg-brand-gradient text-white font-black"
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
              <p className="text-lg font-black">Transferencia creada</p>
              <p className="text-sm text-muted-foreground mt-1">
                El destinatario recibirá un QR para confirmar la transferencia
              </p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monto:</span>
                <span className="font-bold">{formatCurrency(transfer.amount, transfer.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Para:</span>
                <span className="font-bold">{transfer.receiver_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estado:</span>
                <span className="font-bold text-amber-600">Pendiente de confirmación</span>
              </div>
            </div>
            <Button 
              onClick={() => onOpenChange(false)}
              className="w-full bg-brand-gradient text-white font-black"
            >
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
