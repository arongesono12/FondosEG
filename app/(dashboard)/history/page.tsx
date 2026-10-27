'use client';

import { DashboardMetric } from '@/components/dashboard/dashboard-metric';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { correctTransfer, getTransferHistory, type TransferHistoryStatus } from '@/modules/transfers/http/client';
import { isTransferCompleted, isTransferPending, normalizeTransferStatus } from '@/lib/financial';
import { formatCurrency, formatDate, getStatusColor, getStatusText } from '@/lib/utils';
import type { Transfer } from '@/types';
import { AlertTriangle, Download, History, PencilLine, Search } from '@/components/ui/hugeicons';
import { isAdminRole } from '@/lib/roles';
import Link from 'next/link';

type StatusFilter = TransferHistoryStatus;

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;


export default function HistoryPage() {
  const { user } = useAppStore();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const requestId = useRef(0);
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
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Búsqueda, estado y fechas se resuelven en el servidor sobre todo el
  // historial; aquí sólo se pide la primera página y, a demanda, las siguientes.
  const loadFirstPage = useCallback(() => {
    const id = ++requestId.current;
    setListStatus('loading');
    setLoadMoreError(false);
    getTransferHistory({ q: debouncedSearch, status: statusFilter, from: fromDate, to: toDate, limit: PAGE_SIZE })
      .then((page) => {
        if (id !== requestId.current) return;
        setTransfers(page.items);
        setNextCursor(page.nextCursor);
        setListStatus('ready');
        setHasLoadedOnce(true);
      })
      .catch((error: unknown) => {
        if (id !== requestId.current) return;
        console.error('Error loading transfers:', error);
        setListStatus('error');
      });
  }, [debouncedSearch, statusFilter, fromDate, toDate]);

  useEffect(() => {
    if (user) loadFirstPage();
  }, [user, loadFirstPage]);

  const loadMore = () => {
    if (!nextCursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    setLoadMoreError(false);
    getTransferHistory({ q: debouncedSearch, status: statusFilter, from: fromDate, to: toDate, cursor: nextCursor, limit: PAGE_SIZE })
      .then((page) => {
        // Si los filtros cambiaron mientras tanto, esta página ya no aplica.
        if (id !== requestId.current) return;
        setTransfers((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
        setNextCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (id !== requestId.current) return;
        console.error('Error loading more transfers:', error);
        setLoadMoreError(true);
      })
      .finally(() => setLoadingMore(false));
  };

  const filteredTransfers = transfers;
  const hasFilters = Boolean(debouncedSearch || statusFilter !== 'all' || fromDate || toDate);
  const scopeHint = `Sobre ${transfers.length} operaciones cargadas${nextCursor ? ' (hay más)' : ''}`;

  const completedTransfers = transfers.filter((transfer) => isTransferCompleted(transfer.status));
  const createdTransfers = transfers.filter((transfer) => isTransferPending(transfer.status));
  const cancelledTransfers = transfers.filter((transfer) => normalizeTransferStatus(transfer.status) === 'cancelled');
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

  if (!user || (!hasLoadedOnce && listStatus === 'loading')) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-4xl" />
        <div className="grid gap-4 @2xl:grid-cols-3">
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
      {/* Variantes de contenedor (`@4xl:` ≈ `lg:`): la página también se pinta
          en el panel de media pantalla, donde las de viewport se disparaban
          con ~470px de ancho útil. */}
      <section className="app-card p-6 @2xl:p-8">
        <div className="flex flex-col gap-5 @4xl:flex-row @4xl:items-end @4xl:justify-between">
          <div>
            <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              Historial de operaciones
            </Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Trazabilidad completa de transferencias</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
              {isAdminRole(user?.role)
                ? 'Consulta el registro consolidado de la red, filtra por estado y exporta la operación en formato de control.'
                : 'Revisa tu histórico de operaciones con búsqueda rápida, filtros por estado y exportación.'}
            </p>
          </div>

          <Button onClick={exportToCsv} className="w-full shrink-0 rounded-2xl bg-brand-gradient px-6 font-black text-white shadow-xl shadow-pink-500/20 @4xl:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV ({transfers.length})
          </Button>
        </div>
      </section>

      <section className="dashboard-metric-group grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-4">
        {/* Estos totales describen sólo lo cargado en pantalla, no todo el historial. */}
        <DashboardMetric label="Completadas" value={listStatus === 'error' ? '—' : String(completedTransfers.length)} hint={scopeHint} />
        <DashboardMetric label="Pendientes" value={listStatus === 'error' ? '—' : String(createdTransfers.length)} hint={scopeHint} />
        <DashboardMetric label="Canceladas" value={listStatus === 'error' ? '—' : String(cancelledTransfers.length)} hint={scopeHint} />
        <DashboardMetric label="Ticket medio" value={listStatus === 'error' ? '—' : formatCurrency(averageTicket)} hint={`${formatCurrency(totalVolume)} confirmados · ${transfers.length} cargadas`} />
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/5 pb-5">
          <div className="flex flex-col gap-4 @4xl:flex-row @4xl:items-center @4xl:justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <History className="h-5 w-5 text-primary" />
              Registro operativo
            </CardTitle>

            <div className="flex flex-col gap-3 @4xl:flex-row @4xl:items-center">
              <div className="relative w-full min-w-0 @4xl:min-w-[280px]">
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
              <div className="flex gap-2">
                <Label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  Desde
                  <Input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="h-11 rounded-2xl border-border/20 bg-background/70" />
                </Label>
                <Label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  Hasta
                  <Input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="h-11 rounded-2xl border-border/20 bg-background/70" />
                </Label>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="activity-records-scroll">
            <Table className="activity-records-table" wrapperClassName="is-stacked">
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/5 hover:bg-transparent">
                  <TableHead className="pl-8 py-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Código</TableHead>
                  <TableHead className="py-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Participantes</TableHead>
                  <TableHead className="py-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Destino</TableHead>
                  <TableHead className="py-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground text-right">Monto</TableHead>
                  <TableHead className="py-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Estado</TableHead>
                  <TableHead className="py-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Fecha</TableHead>
                  <TableHead className="pr-8 py-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listStatus === 'error' ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-20 text-center text-sm font-bold text-muted-foreground">
                      <div role="alert" className="flex flex-col items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-rose-500" />
                        No se pudo cargar el historial.
                        <Button type="button" variant="outline" className="rounded-xl font-black" onClick={loadFirstPage}>Reintentar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-20 text-center text-sm font-bold text-muted-foreground">
                      {listStatus === 'loading'
                        ? 'Buscando operaciones…'
                        : hasFilters
                          ? 'No hay operaciones que coincidan con los filtros en todo el historial.'
                          : 'Todavía no hay operaciones.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id} className="activity-record-row border-border/5 hover:bg-muted/30">
                      <TableCell data-label="Código" className="pl-8">
                        <p className="font-mono text-sm font-black text-foreground">{transfer.transfer_code}</p>
                        {transfer.agent?.name && (
                          <p className="text-xs font-semibold uppercase text-primary">Gestor {transfer.agent.name}</p>
                        )}
                      </TableCell>
                      <TableCell data-label="Participantes">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-foreground">{transfer.sender_name}</p>
                          <p className="text-xs font-semibold text-muted-foreground">{transfer.receiver_name}</p>
                        </div>
                      </TableCell>
                      <TableCell data-label="Destino">
                        <p className="text-sm font-bold text-foreground">{transfer.destination_city}</p>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{transfer.destination_country || 'N/A'}</p>
                      </TableCell>
                      <TableCell data-label="Monto" className="text-right">
                        <p className="text-sm font-black text-foreground">{formatCurrency(transfer.amount, transfer.currency)}</p>
                      </TableCell>
                      <TableCell data-label="Estado">
                        <Badge className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${getStatusColor(transfer.status)}`}>
                          {getStatusText(transfer.status)}
                        </Badge>
                      </TableCell>
                      <TableCell data-label="Fecha" className="text-xs font-semibold text-muted-foreground">{formatDate(transfer.created_at)}</TableCell>
                      <TableCell data-label="Acciones" className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild type="button" size="sm" variant="outline" className="rounded-xl font-black">
                            <Link href={`/receipts/${transfer.id}`}>
                              <Download className="mr-2 h-4 w-4" />
                              Comprobante
                            </Link>
                          </Button>
                          {showAdminActions &&
                            (canCorrectTransfer(transfer) ? (
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
                              <span className="self-center text-xs font-semibold text-muted-foreground">Bloqueada</span>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {listStatus !== 'error' && transfers.length > 0 && (
            <div className="flex flex-col items-center gap-3 border-t border-border/5 p-5 text-xs font-semibold text-muted-foreground @2xl:flex-row @2xl:justify-between" aria-live="polite">
              <span>
                {transfers.length} operaciones mostradas{nextCursor ? ' · hay más en el historial' : ' · fin del historial'}
                {listStatus === 'loading' && ' · actualizando…'}
              </span>
              {loadMoreError && <span role="alert" className="text-rose-600 dark:text-rose-300">No se pudieron cargar más operaciones.</span>}
              {nextCursor && (
                <Button type="button" variant="outline" className="rounded-xl font-black" onClick={loadMore} disabled={loadingMore || listStatus === 'loading'}>
                  {loadingMore ? 'Cargando…' : loadMoreError ? 'Reintentar' : 'Cargar más'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingTransfer} onOpenChange={(open) => !open && setEditingTransfer(null)}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Corregir envío de gestor</DialogTitle>
            <DialogDescription>
              Ajusta los datos de una transferencia pendiente o disponible para retiro. La corrección actualizará el saldo del gestor y, si aplica, la billetera del cliente vinculado.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* `@md:` mira el ancho del cuerpo del modal, no el de la ventana:
                con `md:` una tableta partía en dos columnas un cuerpo estrecho. */}
            <div className="grid gap-4 @md:grid-cols-2">
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
                  inputMode="decimal"
                  onWheel={(e) => e.currentTarget.blur()}
                  min="1"
                  step="0.01"
                  value={correctionForm.amount}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </div>
              <div className="space-y-2 @md:col-span-2">
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
          </DialogBody>

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
