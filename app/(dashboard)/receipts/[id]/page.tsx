import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, FileCheck2, ShieldCheck } from 'lucide-react';
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
  originAgentName?: string | null;
  paidOutByName?: string | null;
  issuedByName?: string | null;
  issuedByRole?: string | null;
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

function normalizeRole(role?: string | null) {
  if (!role) return 'Usuario autorizado';
  const labels: Record<string, string> = {
    admin: 'Administrador',
    superadmin: 'Superadministrador',
    gestor: 'Gestor',
    client: 'Cliente',
    developer: 'Developer',
  };
  return labels[role] ?? role;
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

  const relatedUserIds = [receipt.agentId, receipt.paidOutBy].filter(Boolean) as string[];
  const userNameById = new Map<string, string>();

  if (relatedUserIds.length) {
    const { data: relatedUsers } = await adminClient
      .from('users')
      .select('id, name')
      .in('id', Array.from(new Set(relatedUserIds)));

    relatedUsers?.forEach((user) => {
      if (user.id && user.name) userNameById.set(user.id, user.name);
    });
  }

  receipt.originAgentName = receipt.agentId ? userNameById.get(receipt.agentId) ?? null : null;
  receipt.paidOutByName = receipt.paidOutBy ? userNameById.get(receipt.paidOutBy) ?? null : null;
  receipt.issuedByName = profile.name;
  receipt.issuedByRole = normalizeRole(profile.role);

  const receiptFields = [
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

  const auditFields = [
    ['Gestor de origen', receipt.originAgentName ?? 'No aplica'],
    ['Gestor pagador', receipt.paidOutByName ?? 'Pendiente / no aplica'],
    ['Comprobante emitido por', receipt.issuedByName ?? 'Usuario autorizado'],
    ['Rol del emisor', receipt.issuedByRole ?? 'Usuario autorizado'],
    ['Fecha de emisión', formatDate(new Date().toISOString())],
  ];

  const compactReceiptFields = [
    ['Servicio', receipt.service],
    ['Canal', receipt.channel],
    ['Ordenante', `${receipt.senderName} · ${receipt.senderPhone}`],
    ['Beneficiario', `${receipt.receiverName} · ${receipt.receiverPhone}`],
    ['Destino', receipt.destination],
    ['Comisión', formatCurrency(receipt.feeAmount, receipt.currency)],
    ['Recepción', formatDate(receipt.createdAt)],
    ['Ejecución', receipt.completedAt ? formatDate(receipt.completedAt) : 'Pendiente'],
  ];

  const compactAuditFields = [
    ['Gestor origen', receipt.originAgentName ?? 'No aplica'],
    ['Gestor pagador', receipt.paidOutByName ?? 'Pendiente / no aplica'],
    ['Emitido por', receipt.issuedByName ?? 'Usuario autorizado'],
    ['Emisión', formatDate(new Date().toISOString())],
  ];

  return (
    <div className="receipt-print-scope mx-auto max-w-5xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/history">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al historial
          </Link>
        </Button>
        <PrintReceiptButton />
      </div>

      <article className="receipt-print-area relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-card shadow-2xl shadow-black/10 ring-1 ring-primary/10 print:rounded-none print:border-slate-300 print:bg-white print:shadow-none print:ring-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(236,72,153,0.16),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.14),transparent_32%)] print:hidden" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.045] print:opacity-[0.07]">
          <Image
            src="/logo fondosEG/LFondosEG.png"
            alt=""
            width={520}
            height={520}
            className="h-[16rem] w-[16rem] rotate-[-18deg] object-contain grayscale md:h-[22rem] md:w-[22rem]"
            priority
          />
        </div>
        <header className="relative border-b border-border/10 bg-background/80 p-4 backdrop-blur-xl print:bg-white md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
                Comprobante de operación
              </Badge>
              <div className="mt-3 flex items-center gap-3">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-background shadow-lg shadow-primary/10 print:border-slate-200">
                  <Image src="/logo fondosEG/LFondosEG.png" alt="FondosEG" width={96} height={96} className="h-9 w-9 object-contain" priority />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">FondosEG</h1>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recibo oficial verificable</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/10 p-3 text-primary print:border-slate-200 print:bg-slate-50 print:text-slate-800">
              <FileCheck2 className="h-7 w-7" />
            </div>
          </div>
        </header>

        <div className="relative p-6 md:p-8">
          <section className="mb-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-primary/15 bg-primary/10 p-5 print:border-slate-200 print:bg-slate-50">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary print:text-slate-700">Referencia de seguridad</p>
              <p className="mt-2 break-all font-mono text-2xl font-bold text-foreground">{receipt.reference}</p>
              <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground">
                Este comprobante está vinculado al historial interno, trazabilidad de participantes y estado operativo de la transferencia.
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/10 p-5 print:border-slate-200 print:bg-slate-50">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500 print:text-slate-700">
                <BadgeCheck className="h-4 w-4" />
                Emisión autorizada
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">{receipt.issuedByName}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{receipt.issuedByRole}</p>
            </div>
          </section>

          <dl className="grid gap-4 sm:grid-cols-2">
            {compactReceiptFields.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border/10 bg-background/55 p-4 shadow-sm shadow-black/5 print:border-slate-200 print:bg-white print:shadow-none">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
                <dd className="mt-2 break-words text-sm font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-6 rounded-3xl border border-border/10 bg-background/60 p-5 print:border-slate-200 print:bg-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trazabilidad del gestor</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {compactAuditFields.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border/10 bg-card/70 p-4 print:border-slate-200 print:bg-slate-50">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
                  <dd className="mt-2 break-words text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-6 rounded-3xl border border-primary/15 bg-primary/10 p-5 print:border-slate-200 print:bg-slate-50">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
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
