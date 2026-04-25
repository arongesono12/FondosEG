'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { correctTransfer, getAllTransfers, getTransfers } from '@/services/transfer';
import { formatCurrency, formatDate, getStatusColor, getStatusText } from '@/lib/utils';
import type { Transfer } from '@/types';
import { Download, History, PencilLine, Search, TrendingUp, Wallet, XCircle } from 'lucide-react';
import { isAdminRole } from '@/lib/roles';

type StatusFilter = 'all' | 'completed' | 'created' | 'available_for_pickup' | 'cancelled';

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">{hint}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-white shadow-lg ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const { user } = useAppStore();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [correctionError, setCorrectionError] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    destination_city: '',
    destination_country: '',
    amount: '',
    notes: '',
  });

  useEffect(() => {
    async function loadTransfers() {
      try {
        const data = isAdminRole(user?.role) ? await getAllTransfers(150) : await getTransfers(150);
        setTransfers(data);
      } catch (error) {
        console.error('Error loading transfers:', error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadTransfers();
    }
  }, [user]);

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch =
      !normalizedSearch ||
      transfer.transfer_code.toLowerCase().includes(normalizedSearch) ||
      transfer.sender_name.toLowerCase().includes(normalizedSearch) ||
      transfer.sender_phone.includes(normalizedSearch) ||
      transfer.receiver_name.toLowerCase().includes(normalizedSearch) ||
      transfer.receiver_phone.includes(normalizedSearch) ||
      transfer.destination_city.toLowerCase().includes(normalizedSearch);

    const matchesStatus = statusFilter === 'all' ? true : transfer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const completedTransfers = transfers.filter((transfer) => transfer.status === 'completed');
  const createdTransfers = transfers.filter((transfer) => transfer.status === 'created' || transfer.status === 'available_for_pickup');
  const cancelledTransfers = transfers.filter((transfer) => transfer.status === 'cancelled');
  const totalVolume = completedTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);
  const averageTicket = completedTransfers.length ? totalVolume / completedTransfers.length : 0;
  const showAdminActions = isAdminRole(user?.role);

  const canCorrectTransfer = (transfer: Transfer) =>
    showAdminActions &&
    transfer.transfer_type !== 'client' &&
    ['created', 'available_for_pickup'].includes(transfer.status);

  const openCorrectionModal = (transfer: Transfer) => {
    setEditingTransfer(transfer);
    setCorrectionError('');
    setCorrectionForm({
      sender_name: transfer.sender_name || '',
      sender_phone: transfer.sender_phone || '',
      receiver_name: transfer.receiver_name || '',
      receiver_phone: transfer.receiver_phone || '',
      destination_city: transfer.destination_city || '',
      destination_country: transfer.destination_country || '',
      amount: String(transfer.amount || ''),
      notes: transfer.notes || '',
    });
  };

  const handleCorrectionSubmit = async () => {
    if (!editingTransfer) return;

    const amount = Number(correctionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCorrectionError('El monto corregido debe ser mayor que cero');
      return;
    }

    setCorrecting(true);
    setCorrectionError('');

    try {
      const result = await correctTransfer(editingTransfer.id, {
        sender_name: correctionForm.sender_name,
        sender_phone: correctionForm.sender_phone,
        receiver_name: correctionForm.receiver_name,
        receiver_phone: correctionForm.receiver_phone,
        destination_city: correctionForm.destination_city,
        destination_country: correctionForm.destination_country,
        amount,
        currency: editingTransfer.currency,
        notes: correctionForm.notes,
      });

      if (!result.success || !result.transfer) {
        setCorrectionError(result.error || 'No se pudo corregir la transferencia');
        return;
      }

      setTransfers((current) =>
        current.map((transfer) => (transfer.id === editingTransfer.id ? { ...transfer, ...result.transfer } : transfer))
      );
      setEditingTransfer(null);
    } catch (error) {
      console.error('Error correcting transfer:', error);
      setCorrectionError(error instanceof Error ? error.message : 'No se pudo corregir la transferencia');
    } finally {
      setCorrecting(false);
    }
  };

  const exportToCsv = () => {
    if (typeof window === 'undefined') return;

    const escapeCsv = (value: unknown) => {
      const stringValue = String(value ?? '');
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const rows = [
      ['Codigo', 'Remitente', 'Telefono_remitente', 'Destinatario', 'Telefono_destinatario', 'Destino', 'Monto', 'Moneda', 'Estado', 'Fecha'],
      ...filteredTransfers.map((transfer) => [
        transfer.transfer_code,
        transfer.sender_name,
        transfer.sender_phone,
        transfer.receiver_name,
        transfer.receiver_phone,
        transfer.destination_city,
        transfer.amount,
        transfer.currency,
        getStatusText(transfer.status),
        formatDate(transfer.created_at),
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_transferencias_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-4xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-4xl border border-border/10 bg-card/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              Historial de operaciones
            </Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Trazabilidad completa de transferencias</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
              {isAdminRole(user?.role)
                ? 'Consulta el registro consolidado de la red, filtra por estado y exporta la operación en formato de control.'
                : 'Revisa tu histórico de operaciones con búsqueda rápida, filtros por estado y exportación.'}
            </p>
          </div>

          <Button onClick={exportToCsv} className="rounded-2xl bg-brand-gradient px-6 font-black text-white shadow-xl shadow-pink-500/20">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Completadas" value={String(completedTransfers.length)} hint="Operaciones cerradas" icon={History} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
        <MetricTile label="Pendientes" value={String(createdTransfers.length)} hint="En seguimiento o pago" icon={Wallet} tone="border-amber-500/20 bg-amber-500 shadow-amber-500/20" />
        <MetricTile label="Canceladas" value={String(cancelledTransfers.length)} hint="Requieren auditoría si crecen" icon={XCircle} tone="border-rose-500/20 bg-rose-500 shadow-rose-500/20" />
        <MetricTile label="Ticket medio" value={formatCurrency(averageTicket)} hint={formatCurrency(totalVolume) + ' de volumen confirmado'} icon={TrendingUp} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
      </section>

      <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-border/5 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <History className="h-5 w-5 text-primary" />
              Registro operativo
            </CardTitle>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-[280px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por código, nombre, teléfono o ciudad..."
                  className="h-11 rounded-2xl border-border/20 bg-background/70 pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'completed', label: 'Completadas' },
                  { id: 'created', label: 'Pendientes' },
                  { id: 'cancelled', label: 'Canceladas' },
                ].map((filter) => (
                  <Button
                    key={filter.id}
                    type="button"
                    variant={statusFilter === filter.id ? 'default' : 'outline'}
                    className="rounded-xl font-black"
                    onClick={() => setStatusFilter(filter.id as StatusFilter)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/5 hover:bg-transparent">
                  <TableHead className="pl-8 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Código</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Participantes</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Destino</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground text-right">Monto</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Estado</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Fecha</TableHead>
                  {showAdminActions && (
                    <TableHead className="pr-8 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground text-right">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showAdminActions ? 7 : 6} className="py-20 text-center text-sm font-bold text-muted-foreground">
                      No hay operaciones que coincidan con los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id} className="border-border/5 hover:bg-muted/30">
                      <TableCell className="pl-8">
                        <p className="font-mono text-sm font-black text-foreground">{transfer.transfer_code}</p>
                        {transfer.agent?.name && (
                          <p className="text-[10px] font-semibold uppercase text-primary">Gestor {transfer.agent.name}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-foreground">{transfer.sender_name}</p>
                          <p className="text-xs font-semibold text-muted-foreground">{transfer.receiver_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-bold text-foreground">{transfer.destination_city}</p>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{transfer.destination_country || 'N/A'}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-black text-foreground">{formatCurrency(transfer.amount, transfer.currency)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getStatusColor(transfer.status)}`}>
                          {getStatusText(transfer.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground">{formatDate(transfer.created_at)}</TableCell>
                      {showAdminActions && (
                        <TableCell className="pr-8 text-right">
                          {canCorrectTransfer(transfer) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-xl font-black"
                              onClick={() => openCorrectionModal(transfer)}
                            >
                              <PencilLine className="mr-2 h-4 w-4" />
                              Corregir
                            </Button>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">Bloqueada</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingTransfer} onOpenChange={(open) => !open && setEditingTransfer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corregir envío de gestor</DialogTitle>
            <DialogDescription>
              Ajusta los datos de una transferencia pendiente o disponible para retiro. La corrección actualizará el saldo del gestor y, si aplica, la billetera del cliente vinculado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="correction_sender_name">Remitente</Label>
              <Input
                id="correction_sender_name"
                value={correctionForm.sender_name}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, sender_name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction_sender_phone">Teléfono remitente</Label>
              <Input
                id="correction_sender_phone"
                value={correctionForm.sender_phone}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, sender_phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction_receiver_name">Destinatario</Label>
              <Input
                id="correction_receiver_name"
                value={correctionForm.receiver_name}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, receiver_name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction_receiver_phone">Teléfono destinatario</Label>
              <Input
                id="correction_receiver_phone"
                value={correctionForm.receiver_phone}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, receiver_phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction_destination_city">Ciudad destino</Label>
              <Input
                id="correction_destination_city"
                value={correctionForm.destination_city}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, destination_city: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction_destination_country">País destino</Label>
              <Input
                id="correction_destination_country"
                value={correctionForm.destination_country}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, destination_country: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction_amount">Monto</Label>
              <Input
                id="correction_amount"
                type="number"
                min="1"
                step="0.01"
                value={correctionForm.amount}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="correction_notes">Notas</Label>
              <Input
                id="correction_notes"
                value={correctionForm.notes}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>

          {correctionError && (
            <p className="text-sm font-semibold text-rose-500">{correctionError}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl font-black" onClick={() => setEditingTransfer(null)}>
              Cancelar
            </Button>
            <Button type="button" className="rounded-xl font-black" onClick={handleCorrectionSubmit} disabled={correcting}>
              {correcting ? 'Corrigiendo...' : 'Guardar corrección'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
