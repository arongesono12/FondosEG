'use client';

import { MetricArea, MetricBars, MetricCard, MetricDesk, MetricTiles, ModuleMetrics, ModuleMetricsSkeleton } from '@/components/dashboard/module-metric-card';
import { lastDaysSeries } from '@/lib/dashboard-series';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { correctTransfer, getTransferHistory, type TransferHistoryStatus } from '@/modules/transfers/http/client';
import { isTransferCompleted, isTransferPending, normalizeTransferStatus } from '@/lib/financial';
import { formatCurrency, formatDate, getStatusText } from '@/lib/utils';
import type { Transfer } from '@/types';
import { DateRangeFilter } from '@/components/dashboard/date-range-filter';
import { ExpandableSearch } from '@/components/dashboard/expandable-search';
import { RecordDetailAction, RecordDetailEmpty, RecordDetailNote, RecordListEmpty, RecordTileAction } from '@/components/dashboard/record-panel';
import { TransferRecordPanel } from '@/components/dashboard/transfer-record-panel';
import { ArrowUpRight, CheckCircle2, Clock, Download, PencilLine, Receipt } from '@/components/ui/hugeicons';
import { isAdminRole } from '@/lib/roles';

type StatusFilter = TransferHistoryStatus;

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
// Sin contador: el estado se filtra en el servidor y aquí sólo hay una página cargada.
const HISTORY_TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'created', label: 'Pendientes' },
  { value: 'cancelled', label: 'Canceladas' },
];


export default function HistoryPage() {
  const { user } = useAppStore();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [hasFailedLoad, setHasFailedLoad] = useState(false);
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
        setHasFailedLoad(true);
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
  // Al reintentar tras un fallo aún no hay datos: un 0 aquí parecería un total real.
  const metricsUnavailable = listStatus === 'error' || !hasLoadedOnce;
  const metricValue = (value: number) => (metricsUnavailable ? '—' : String(value));
  // La lista llega de más reciente a más antigua. Las series acaban en la última
  // operación cargada para que un filtro de fechas antiguas no las deje vacías.
  const latestLoaded = transfers[0] ? new Date(transfers[0].created_at) : new Date();
  const completedByDay = lastDaysSeries(completedTransfers, (transfer) => transfer.created_at, () => 1, latestLoaded);
  const volumeByDay = lastDaysSeries(completedTransfers, (transfer) => transfer.created_at, (transfer) => transfer.amount, latestLoaded);
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

  // Sólo en la primera carga: tras un fallo, el esqueleto desmontaría la búsqueda abierta.
  if (!user || (!hasLoadedOnce && !hasFailedLoad && listStatus === 'loading')) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-4xl" />
        <ModuleMetricsSkeleton />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Variantes de contenedor (`@4xl:` ≈ `lg:`) según el ancho de la página. */}
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

      <ModuleMetrics label="Resumen del historial">
        {/* Estos totales describen sólo lo cargado en pantalla, no todo el historial. */}
        <MetricCard layout="desk" title="Pendientes" value={metricValue(createdTransfers.length)} caption={scopeHint}>
          <MetricDesk />
        </MetricCard>
        <MetricCard title="Completadas" value={metricValue(completedTransfers.length)} caption={scopeHint}>
          <MetricBars data={completedByDay} seriesLabel="Completadas" />
        </MetricCard>
        <MetricCard
          title="Ticket medio"
          value={metricsUnavailable ? '—' : formatCurrency(averageTicket)}
          caption={<><span className="overview-tone-success">{formatCurrency(totalVolume)}</span> confirmados</>}
        >
          <MetricArea data={volumeByDay} seriesLabel="Volumen" format={formatCurrency} legend="Volumen confirmado · 7 días" />
        </MetricCard>
        <MetricCard
          layout="tiles"
          title="Canceladas"
          value={metricValue(cancelledTransfers.length)}
          caption={scopeHint}
          action={{ href: '/transfers', label: 'Ir a envíos', icon: <ArrowUpRight /> }}
        >
          <MetricTiles tiles={[
            { icon: <CheckCircle2 />, title: 'Completas', detail: metricValue(completedTransfers.length) },
            { icon: <Receipt />, title: 'Cargadas', detail: metricValue(transfers.length), featured: true },
            { icon: <Clock />, title: 'Pendientes', detail: metricValue(createdTransfers.length) },
          ]} />
        </MetricCard>
      </ModuleMetrics>

      <TransferRecordPanel
        label="Registro operativo"
        title="Registro operativo"
        subtitle={`Operaciones cargadas: ${transfers.length}`}
        transfers={listStatus === 'error' ? [] : filteredTransfers}
        format={formatCurrency}
        tabs={HISTORY_TABS}
        activeTab={statusFilter}
        onTabChange={(value) => setStatusFilter(value as StatusFilter)}
        corner={(
          <>
            <ExpandableSearch
              value={searchTerm}
              onChange={setSearchTerm}
              label="Buscar por código, nombre, teléfono o ciudad"
              placeholder="Código, nombre, teléfono o ciudad"
            />
            <DateRangeFilter from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
          </>
        )}
        cornerRow="laptop"
        detailed
        emptyList={listStatus === 'error'
          ? <RecordListEmpty role="alert"><p>No se pudo cargar el historial.</p><button type="button" onClick={loadFirstPage}>Reintentar</button></RecordListEmpty>
          : (
            <RecordListEmpty busy={listStatus === 'loading'}>
              <p>
                {listStatus === 'loading'
                  ? 'Buscando operaciones…'
                  : hasFilters
                    ? 'No hay operaciones que coincidan con los filtros en todo el historial.'
                    : 'Todavía no hay operaciones.'}
              </p>
            </RecordListEmpty>
          )}
        emptyDetail={listStatus === 'error'
          ? <RecordDetailEmpty title="Historial no disponible" />
          : listStatus === 'loading'
            ? <RecordDetailEmpty title="Buscando…" />
            : hasFilters
              ? <RecordDetailEmpty title="Sin resultados" description="Ajusta los filtros para consultar una operación." />
              : <RecordDetailEmpty title="Cada envío, al detalle" description="Aquí aparecerán el importe, el destinatario y el estado de tus operaciones." />}
        tileAction={(transfer) => <RecordTileAction href={`/receipts/${transfer.id}`} label="Comprobante" icon={<Download />} />}
        footerAction={(transfer) => {
          if (!showAdminActions) return null;
          return canCorrectTransfer(transfer)
            ? <RecordDetailAction onSelect={() => openCorrectionModal(transfer)}><PencilLine />Corregir</RecordDetailAction>
            : <RecordDetailNote>Bloqueada</RecordDetailNote>;
        }}
        listFooter={listStatus !== 'error' && transfers.length > 0 && (
          <div className="overview-record-footer" aria-live="polite">
            <span>
              {transfers.length} operaciones mostradas{nextCursor ? ' · hay más en el historial' : ' · fin del historial'}
              {listStatus === 'loading' && ' · actualizando…'}
            </span>
            {loadMoreError && <span role="alert">No se pudieron cargar más operaciones.</span>}
            {nextCursor && (
              <Button type="button" variant="outline" size="sm" className="rounded-xl font-black" onClick={loadMore} disabled={loadingMore || listStatus === 'loading'}>
                {loadingMore ? 'Cargando…' : loadMoreError ? 'Reintentar' : 'Cargar más'}
              </Button>
            )}
          </div>
        )}
      />

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
