import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileCheck2, ShieldCheck } from 'lucide-react';
import { PAYMENT_REGULATION } from '@/lib/compliance';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/server/authz';
import { isAdminRole } from '@/lib/roles';
import { formatCurrency, formatDate, getStatusText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PrintReceiptButton } from '@/components/compliance/print-receipt-button';

interface ReceiptRecord {
  id: string;
  reference: string;
  service: string;
  senderId?: string | null;
  receiverId?: string | null;
  agentId?: string | null;
  paidOutBy?: string | null;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  destination: string;
  amount: number;
  currency: string;
  feeAmount: number;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  channel: string;
}

function canViewReceipt(profile: { id: string; role: string }, receipt: ReceiptRecord) {
  return (
    isAdminRole(profile.role) ||
    receipt.senderId === profile.id ||
    receipt.receiverId === profile.id ||
    receipt.agentId === profile.id ||
    receipt.paidOutBy === profile.id
  );
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const adminClient = createAdminClient();

  const { data: transfer } = await adminClient.from('transfers').select('*').eq('id', id).maybeSingle();

  let receipt: ReceiptRecord | null = transfer
    ? {
        id: transfer.id,
        reference: transfer.transfer_code,
        service: 'Transferencia de fondos',
        senderId: transfer.sender_id,
        receiverId: transfer.receiver_user_id,
        agentId: transfer.agent_id,
        paidOutBy: transfer.paid_out_by,
        senderName: transfer.sender_name,
        senderPhone: transfer.sender_phone,
        receiverName: transfer.receiver_name,
        receiverPhone: transfer.receiver_phone,
        destination: [transfer.destination_city, transfer.destination_country].filter(Boolean).join(', '),
        amount: Number(transfer.amount),
        currency: transfer.currency,
        feeAmount: Number(transfer.commission_amount || 0),
        status: transfer.status,
        createdAt: transfer.created_at,
        completedAt: transfer.completed_at,
        channel: transfer.transfer_type === 'client' ? 'Billetera FondosEG' : 'Red de gestores FondosEG',
      }
    : null;

  if (!receipt) {
    const { data: walletTransfer } = await adminClient.from('wallet_transfers').select('*').eq('id', id).maybeSingle();
    if (walletTransfer) {
      receipt = {
        id: walletTransfer.id,
        reference: `WT-${String(walletTransfer.id).slice(0, 8).toUpperCase()}`,
        service: 'Transferencia entre billeteras',
        senderId: walletTransfer.sender_id,
        receiverId: walletTransfer.receiver_id,
        senderName: walletTransfer.sender_name,
        senderPhone: walletTransfer.sender_phone,
        receiverName: walletTransfer.receiver_name,
        receiverPhone: walletTransfer.receiver_phone,
        destination: 'Billetera FondosEG',
        amount: Number(walletTransfer.amount),
        currency: walletTransfer.currency,
        feeAmount: 0,
        status: walletTransfer.status,
        createdAt: walletTransfer.created_at,
        completedAt: walletTransfer.confirmed_at,
        channel: 'Billetera FondosEG',
      };
    }
  }

  if (!receipt || !canViewReceipt(profile, receipt)) {
    notFound();
  }

  const fields = [
    ['Referencia', receipt.reference],
    ['Servicio', receipt.service],
    ['Canal', receipt.channel],
    ['Ordenante', `${receipt.senderName} · ${receipt.senderPhone}`],
    ['Beneficiario', `${receipt.receiverName} · ${receipt.receiverPhone}`],
    ['Destino', receipt.destination],
    ['Importe', formatCurrency(receipt.amount, receipt.currency)],
    ['Comisión informada', formatCurrency(receipt.feeAmount, receipt.currency)],
    ['Fecha de recepción', formatDate(receipt.createdAt)],
    ['Fecha de ejecución', receipt.completedAt ? formatDate(receipt.completedAt) : 'Pendiente'],
    ['Estado', getStatusText(receipt.status)],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/history">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al historial
          </Link>
        </Button>
        <PrintReceiptButton />
      </div>

      <article className="overflow-hidden rounded-[2rem] border border-border/15 bg-card shadow-2xl shadow-black/5 print:rounded-none print:border-slate-300 print:shadow-none">
        <header className="border-b border-border/10 bg-primary/5 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <Badge className="rounded-full bg-primary/10 text-primary">Comprobante de operación</Badge>
              <h1 className="mt-4 text-3xl font-black text-foreground">FondosEG</h1>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Evidencia durable de recepción y ejecución de una orden de pago.
              </p>
            </div>
            <FileCheck2 className="h-12 w-12 text-primary" />
          </div>
        </header>

        <div className="p-6 md:p-8">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label} className="border-b border-border/10 pb-4">
                <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-sm font-black text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 rounded-2xl border border-primary/15 bg-primary/5 p-5">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary">
              <ShieldCheck className="h-4 w-4" />
              Información regulatoria
            </p>
            <p className="mt-3 text-xs font-semibold leading-6 text-muted-foreground">
              Operación documentada bajo la versión {PAYMENT_REGULATION.disclosureVersion}, asociada al
              Reglamento n.º {PAYMENT_REGULATION.code}. Para impugnarla, utiliza la referencia anterior en
              el módulo de Cumplimiento.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
