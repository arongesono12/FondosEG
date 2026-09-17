'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCheck, ChevronDown, Clock3, Filter, Landmark, LifeBuoy, Plus, Receipt, Search, Wallet, X } from '@/components/ui/hugeicons';
import { Area, AreaChart, Bar, BarChart, XAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn, convertCurrency, formatCurrency, formatDateShort, getInitials } from '@/lib/utils';
import type { DashboardStats, DailyTransferStats, Transfer } from '@/types';

const chartConfig = { amount: { label: 'Volumen', color: 'var(--chart-1)' } } satisfies ChartConfig;
const statusLabels: Record<Transfer['status'], string> = {
  created: 'Pendiente', available_for_pickup: 'Disponible', paid_out: 'Pagada', completed: 'Completada', cancelled: 'Cancelada',
};
type TransferView = 'all' | 'pending' | 'completed';

interface DashboardOverviewProps {
  stats: DashboardStats | null;
  dailyStats: DailyTransferStats[];
  transfers: Transfer[];
  currency: string;
  isClient: boolean;
  primaryAction: { href: string; label: string };
  onSupport: () => void;
}

export function DashboardOverview({ stats, dailyStats, transfers, currency, isClient, primaryAction, onSupport }: DashboardOverviewProps) {
  const [status, setStatus] = useState('all');
  const [city, setCity] = useState('all');
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [view, setView] = useState<TransferView>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fmt = (value: number) => formatCurrency(convertCurrency(value, 'XAF', currency), currency);
  const fmtTransfer = (value: number, source: string) => formatCurrency(convertCurrency(value, source, currency), currency);
  const cities = [...new Set(transfers.map((transfer) => transfer.destination_city).filter(Boolean))];
  const pending = (transfer: Transfer) => ['created', 'available_for_pickup'].includes(transfer.status);
  const completed = (transfer: Transfer) => ['completed', 'paid_out'].includes(transfer.status);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = transfers.filter((transfer) => {
    const date = new Date(transfer.created_at);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return (status === 'all' || transfer.status === status)
      && (city === 'all' || transfer.destination_city === city)
      && (!fromDate || dateKey >= fromDate) && (!toDate || dateKey <= toDate)
      && normalize(`${transfer.transfer_code} ${transfer.sender_name} ${transfer.receiver_name}`).includes(normalize(query));
  });
  const visible = filtered.filter((transfer) => view === 'all' || (view === 'pending' ? pending(transfer) : completed(transfer)));
  const selected = visible.find((transfer) => transfer.id === selectedId) ?? visible[0];
  const activeFilters = [status !== 'all', city !== 'all', !!query, !!fromDate, !!toDate].filter(Boolean).length;
  const clearFilters = () => { setStatus('all'); setCity('all'); setQuery(''); setFromDate(''); setToDate(''); setView('all'); };
  const trend = dailyStats.slice(-7).map((day) => ({ date: formatDateShort(day.date).slice(0, 5), amount: convertCurrency(day.total_amount, 'XAF', currency) }));
  const balance = stats?.availableBalance ?? stats?.totalBalance ?? 0;
  const reserved = stats?.reservedBalance ?? stats?.pendingExposure ?? 0;
  const tabs: { value: TransferView; label: string; count: number }[] = [
    { value: 'all', label: 'Todas', count: filtered.length },
    { value: 'completed', label: 'Completadas', count: filtered.filter(completed).length },
    { value: 'pending', label: 'Pendientes', count: filtered.filter(pending).length },
  ];

  return (
    <div className="overview">
      <div className="overview-heading">
        <div className="overview-title-group">
          <Link href="/" className="overview-icon-button" aria-label="Volver al inicio"><ArrowLeft /></Link>
          <div><h1>Dashboard</h1><p>Gestiona tus fondos y sigue cada envío en un solo lugar.</p></div>
        </div>
        <div className="overview-heading-actions">
          <button className="overview-icon-button" onClick={onSupport} aria-label="Contactar con soporte"><LifeBuoy /></button>
          <Link href={primaryAction.href} className="overview-primary-action"><Plus />{primaryAction.label}</Link>
        </div>
      </div>

      <section className="overview-metrics" aria-label="Resumen financiero">
        <article className="overview-metric overview-metric-desk">
          <div className="overview-metric-label"><h2>{isClient ? 'Saldo retenido' : 'En tránsito'}</h2><Clock3 className="overview-tone-warning" /></div>
          <p className="overview-metric-value">{fmt(reserved)}</p>
          <p className="overview-metric-caption"><span className="overview-tone-warning">{stats?.pendingTransfers ?? 0} pendientes</span> de liquidación</p>
          <div className="overview-desk"><Image src="/images/dashboard-desk.png" alt="" fill sizes="(max-width: 600px) 50vw, 25vw" /></div>
        </article>

        <article className="overview-metric">
          <div className="overview-metric-label"><h2>Volumen de la semana</h2><CalendarDays className="overview-tone-primary" /></div>
          <p className="overview-metric-value">{fmt(stats?.weeklyVolume ?? 0)}</p>
          <p className="overview-metric-caption"><span className="overview-tone-primary">{stats?.todayTransfers ?? 0} operaciones</span> registradas hoy</p>
          {trend.length ? <ChartContainer config={chartConfig} className="overview-mini-chart aspect-auto">
            <BarChart accessibilityLayer data={trend} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
              <defs><linearGradient id="overview-bars" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.28} /></linearGradient></defs>
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value), currency)} />} />
              <Bar dataKey="amount" fill="url(#overview-bars)" radius={[3, 3, 0, 0]} maxBarSize={17} />
            </BarChart>
          </ChartContainer> : <div className="overview-chart-empty"><BarChartPlaceholder /><span>{isClient ? 'Consulta tu actividad en el historial' : 'Tu actividad aparecerá aquí'}</span></div>}
        </article>

        <article className="overview-metric">
          <div className="overview-metric-label"><h2>{isClient ? 'Tasa de cierre' : 'Comisiones generadas'}</h2><CheckCheck className="overview-tone-success" /></div>
          <p className="overview-metric-value">{isClient ? <>{stats?.settlementRate ?? 0}<small> %</small></> : fmt(stats?.totalCommission ?? 0)}</p>
          <p className="overview-metric-caption"><span className="overview-tone-success">{isClient ? `${stats?.completedTransfers ?? 0} completadas` : fmt(stats?.todayCommission ?? 0)}</span>{isClient ? ' en total' : ' generadas hoy'}</p>
          {trend.length ? <ChartContainer config={chartConfig} className="overview-mini-chart aspect-auto">
            <AreaChart accessibilityLayer data={trend} margin={{ top: 16, bottom: 12, left: 5, right: 5 }}>
              <defs><linearGradient id="overview-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value), currency)} />} />
              <Area dataKey="amount" type="linear" fill="url(#overview-area)" stroke="var(--chart-1)" strokeWidth={1.7} dot={{ r: 2.5, fill: 'var(--surface)', strokeWidth: 1.5 }} />
            </AreaChart>
          </ChartContainer> : <div className="overview-rate"><span style={{ width: `${Math.max(0, Math.min(stats?.settlementRate ?? 0, 100))}%` }} /><p>{stats?.settlementRate ?? 0}% de operaciones liquidadas</p></div>}
          {trend.length > 0 && <span className="overview-chart-legend">Evolución del volumen · 7 días</span>}
        </article>

        <article className="overview-metric overview-balance">
          <div className="overview-metric-label"><h2>Disponible para operar</h2><Link href="/balance" aria-label="Ver saldo y movimientos" className="overview-icon-button"><ArrowUpRight /></Link></div>
          <p className="overview-metric-value">{fmt(balance)}</p>
          <p className="overview-metric-caption"><Wallet className="overview-tone-success" />{isClient ? 'Tu billetera FondosEG' : 'Liquidez inmediata'}</p>
          <div className="overview-wallets">
            <Link className="overview-wallet" href="/balance"><Landmark /><strong>Capital</strong><span>{fmt(stats?.totalBalance ?? 0)}</span></Link>
            <Link className="overview-wallet is-featured" href="/balance"><Wallet /><strong>Disponible</strong><span>{currency}</span></Link>
            <Link className="overview-wallet" href="/history"><Receipt /><strong>Actividad</strong><span>Ver historial</span></Link>
          </div>
        </article>
      </section>

      <section className="overview-filters" aria-label="Filtrar operaciones recientes">
        <div className="overview-filter-label"><Filter /><span>Filtros</span><b>{activeFilters}</b>{activeFilters > 0 && <button onClick={clearFilters} aria-label="Limpiar filtros"><X /></button>}</div>
        <label className="overview-select"><span className="sr-only">Ciudad de destino</span><select value={city} onChange={(event) => setCity(event.target.value)}><option value="all">Todas las ciudades</option>{cities.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown /></label>
        <label className="overview-select"><span className="sr-only">Estado de la operación</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown /></label>
        <label className="overview-date"><span>Desde</span><input type="date" aria-label="Fecha inicial" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label className="overview-date"><span>Hasta</span><input type="date" aria-label="Fecha final" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
        <label className="overview-search"><span className="sr-only">Buscar por código o nombre</span><input placeholder="Buscar operación" value={query} onChange={(event) => setQuery(event.target.value)} /><Search /></label>
      </section>

      <section className="overview-operations" aria-label="Operaciones recientes">
        <header className="overview-operations-heading">
          <div><h2>Operaciones recientes</h2><span>Últimas {transfers.length} operaciones</span></div>
          <div className="overview-operation-tabs" role="group" aria-label="Mostrar operaciones">
            {tabs.map((tab) => <button key={tab.value} aria-pressed={view === tab.value} className={cn(view === tab.value && 'is-active')} onClick={() => setView(tab.value)}>{tab.label}<span>{tab.count}</span></button>)}
          </div>
          <Link href="/history" className="overview-history-link" aria-label="Ver historial completo"><Receipt /><ArrowUpRight /></Link>
        </header>
        <div className="overview-operations-body">
          <div className="overview-transfer-list" aria-label="Seleccionar una operación">
            {visible.length ? visible.map((transfer) => <button key={transfer.id} className={cn('overview-transfer', selected?.id === transfer.id && 'is-selected')} aria-pressed={selected?.id === transfer.id} onClick={() => setSelectedId(transfer.id)}>
              <span className="overview-person-avatar">{getInitials(transfer.receiver_name || transfer.sender_name)}</span>
              <span className="overview-transfer-identity"><strong>#{transfer.transfer_code}</strong><small>{formatDateShort(transfer.created_at)}</small></span>
              <span className="overview-transfer-state">{statusLabels[transfer.status]}</span>
              <strong className="overview-transfer-amount">{fmtTransfer(transfer.amount, transfer.currency)}</strong>
            </button>) : <div className="overview-empty"><Search /><p>{transfers.length ? 'No hay operaciones con estos filtros.' : 'Todavía no hay operaciones.'}</p>{transfers.length > 0 && <button onClick={clearFilters}>Limpiar filtros</button>}</div>}
          </div>
          <div className="overview-transfer-detail" aria-live="polite" aria-atomic="true">
            {selected ? <>
              <div className="overview-detail-heading">
                <div><span className="overview-detail-label">Detalle de la operación</span><div className="overview-detail-code"><h3>#{selected.transfer_code}</h3><span>{statusLabels[selected.status]}</span></div></div>
                <div><span className="overview-detail-label">Remitente</span><strong>{selected.sender_name}</strong><small>{selected.sender_phone}</small></div>
                <div><span className="overview-detail-label">Destinatario</span><div className="overview-recipient"><span className="overview-person-avatar">{getInitials(selected.receiver_name)}</span><div><strong>{selected.receiver_name}</strong><small>{selected.destination_city}</small></div></div></div>
              </div>
              <div className="overview-detail-tiles">
                <div><ArrowUpRight /><strong>{fmtTransfer(selected.amount, selected.currency)}</strong><span>Importe del envío</span></div>
                <div><ArrowUpRight /><strong>{typeof selected.commission_amount === 'number' ? fmtTransfer(selected.commission_amount, selected.currency) : '—'}</strong><span>Comisión</span></div>
                <div><CalendarDays /><strong>{formatDateShort(selected.created_at)}</strong><span>{selected.transfer_type === 'client' ? 'Entre clientes' : 'Envío de gestor'}</span></div>
                <Link href="/transfers" className="overview-add-transfer"><Plus /><span>Nuevo envío</span></Link>
              </div>
              {selected.notes && <p className="overview-transfer-notes">{selected.notes}</p>}
              <footer className="overview-detail-footer">
                <div><span>Importe</span><strong>{fmtTransfer(selected.amount, selected.currency)}</strong></div>
                <div><span>Destino</span><strong>{selected.destination_city || '—'}</strong></div>
                <div><span>Estado</span><strong>{statusLabels[selected.status]}</strong></div>
                <Link href="/history" className="overview-detail-action">Ver en historial<ArrowUpRight /></Link>
              </footer>
            </> : <div className="overview-empty overview-empty-detail"><Receipt /><h3>{transfers.length ? 'Sin resultados' : 'Cada envío, al detalle'}</h3><p>{transfers.length ? 'Ajusta los filtros para consultar una operación.' : 'Aquí aparecerán el importe, el destinatario y el estado de tus operaciones.'}</p><Link href={transfers.length ? '/history' : primaryAction.href}>{transfers.length ? 'Ver historial completo' : primaryAction.label}<ArrowUpRight /></Link></div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function BarChartPlaceholder() {
  return <div className="overview-chart-placeholder" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>;
}
