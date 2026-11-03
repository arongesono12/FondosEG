'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ChevronDown, Landmark, LifeBuoy, Plus, Receipt, Search, Wallet, X } from '@/components/ui/hugeicons';
import { convertCurrency, formatCurrency } from '@/lib/utils';
import { dailySeries } from '@/lib/dashboard-series';
import type { DashboardStats, DailyTransferStats, Transfer } from '@/types';
import type { RemoteStatus } from '@/lib/use-remote-block';
import { MetricArea, MetricBars, MetricCard, MetricChartEmpty, MetricDesk, MetricRate, MetricTiles } from '@/components/dashboard/module-metric-card';
import { RecordDetailEmpty, RecordListEmpty, RecordTileAction } from '@/components/dashboard/record-panel';
import { TransferHistoryAction, TransferHistoryLink, TransferRecordPanel, transferStatusLabels, transferTabDefinitions } from '@/components/dashboard/transfer-record-panel';
import { buildRecordTabs, filterByRecordTab } from '@/lib/record-tabs';



interface DashboardOverviewProps {
  stats: DashboardStats | null;
  dailyStats: DailyTransferStats[];
  dailyStatus: RemoteStatus;
  onRetryDaily: () => void;
  transfers: Transfer[];
  transfersStatus: RemoteStatus;
  onRetryTransfers: () => void;
  currency: string;
  isClient: boolean;
  primaryAction: { href: string; label: string };
  onSupport: () => void;
}

export function DashboardOverview({ stats, dailyStats, dailyStatus, onRetryDaily, transfers, transfersStatus, onRetryTransfers, currency, isClient, primaryAction, onSupport }: DashboardOverviewProps) {
  const [status, setStatus] = useState('all');
  const [city, setCity] = useState('all');
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [view, setView] = useState('all');
  const fmt = (value: number) => formatCurrency(convertCurrency(value, 'XAF', currency), currency);
  // Sin stats las cifras son desconocidas («—»), no cero.
  const money = (value: number | undefined) => (stats ? fmt(value ?? 0) : '—');
  const count = (value: number | undefined) => (stats ? String(value ?? 0) : '—');
  const transfersUnavailable = !transfers.length && transfersStatus !== 'ready';
  const trendUnavailable = !dailyStats.length && dailyStatus === 'error';
  const fmtTransfer = (value: number, source: string) => formatCurrency(convertCurrency(value, source, currency), currency);
  const cities = [...new Set(transfers.map((transfer) => transfer.destination_city).filter(Boolean))];
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = transfers.filter((transfer) => {
    const date = new Date(transfer.created_at);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return (status === 'all' || transfer.status === status)
      && (city === 'all' || transfer.destination_city === city)
      && (!fromDate || dateKey >= fromDate) && (!toDate || dateKey <= toDate)
      && normalize(`${transfer.transfer_code} ${transfer.sender_name} ${transfer.receiver_name}`).includes(normalize(query));
  });
  const visible = filterByRecordTab(filtered, transferTabDefinitions, view);
  const activeFilters = [status !== 'all', city !== 'all', !!query, !!fromDate, !!toDate].filter(Boolean).length;
  const clearFilters = () => { setStatus('all'); setCity('all'); setQuery(''); setFromDate(''); setToDate(''); setView('all'); };
  const trend = dailySeries(dailyStats, (day) => convertCurrency(day.total_amount, 'XAF', currency));
  const formatTrend = (value: number) => formatCurrency(value, currency);
  const balance = stats?.availableBalance ?? stats?.totalBalance;
  const reserved = stats?.reservedBalance ?? stats?.pendingExposure;
  const tabs = buildRecordTabs(filtered, transferTabDefinitions);

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
        <MetricCard
          layout="desk"
          title={isClient ? 'Saldo retenido' : 'En tránsito'}
          value={money(reserved)}
          caption={<><span className="overview-tone-warning">{count(stats?.pendingTransfers)} pendientes</span> de liquidación</>}
        >
          <MetricDesk />
        </MetricCard>

        <MetricCard
          title="Volumen de la semana"
          value={money(stats?.weeklyVolume)}
          caption={<><span className="overview-tone-primary">{count(stats?.todayTransfers)} operaciones</span> registradas hoy</>}
        >
          <MetricBars
            data={trend}
            seriesLabel="Volumen"
            format={formatTrend}
            empty={trendUnavailable
              ? <MetricChartEmpty alert message="No se pudo cargar la tendencia."><button type="button" onClick={onRetryDaily} className="underline underline-offset-4">Reintentar</button></MetricChartEmpty>
              : <MetricChartEmpty message={isClient ? 'Consulta tu actividad en el historial' : 'Tu actividad aparecerá aquí'} />}
          />
        </MetricCard>

        <MetricCard
          title={isClient ? 'Tasa de cierre' : 'Comisiones generadas'}
          value={isClient ? <>{count(stats?.settlementRate)}<small> %</small></> : money(stats?.totalCommission)}
          caption={<><span className="overview-tone-success">{isClient ? `${count(stats?.completedTransfers)} completadas` : money(stats?.todayCommission)}</span>{isClient ? ' en total' : ' generadas hoy'}</>}
        >
          <MetricArea
            data={trend}
            seriesLabel="Volumen"
            format={formatTrend}
            legend="Evolución del volumen · 7 días"
            empty={<MetricRate value={stats?.settlementRate ?? 0} label={`${count(stats?.settlementRate)}% de operaciones liquidadas`} />}
          />
        </MetricCard>

        <MetricCard
          layout="tiles"
          title="Disponible para operar"
          value={money(balance)}
          caption={isClient ? 'Tu billetera FondosEG' : 'Liquidez inmediata'}
          action={{ href: '/balance', label: 'Ver saldo y movimientos', icon: <ArrowUpRight /> }}
        >
          <MetricTiles tiles={[
            { icon: <Landmark />, title: 'Capital', detail: money(stats?.totalBalance), href: '/balance' },
            { icon: <Wallet />, title: 'Disponible', detail: currency, href: '/balance', featured: true },
            { icon: <Receipt />, title: 'Actividad', detail: 'Ver historial', href: '/history' },
          ]} />
        </MetricCard>
      </section>

      <section className="overview-filters" aria-label="Filtrar operaciones recientes">
        <div className="overview-filter-label"><span>Filtros</span><b data-active={activeFilters > 0}>{activeFilters}</b>{activeFilters > 0 && <button onClick={clearFilters} aria-label="Limpiar filtros"><X /></button>}</div>
        <label className="overview-select"><span className="sr-only">Ciudad de destino</span><select value={city} onChange={(event) => setCity(event.target.value)}><option value="all">Todas las ciudades</option>{cities.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown /></label>
        <label className="overview-select"><span className="sr-only">Estado de la operación</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos los estados</option>{Object.entries(transferStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown /></label>
        <label className="overview-date"><span>Desde</span><input type="date" aria-label="Fecha inicial" data-empty={!fromDate} value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label className="overview-date"><span>Hasta</span><input type="date" aria-label="Fecha final" data-empty={!toDate} value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
        <label className="overview-search"><span className="sr-only">Buscar por código o nombre</span><input placeholder="Buscar operación" value={query} onChange={(event) => setQuery(event.target.value)} /><Search /></label>
      </section>

      <TransferRecordPanel
        label="Operaciones recientes"
        title="Operaciones recientes"
        subtitle={transfersUnavailable ? 'Operaciones no disponibles' : `Últimas ${transfers.length} operaciones`}
        transfers={visible}
        format={fmtTransfer}
        tabs={tabs}
        activeTab={view}
        onTabChange={setView}
        corner={<TransferHistoryLink />}
        emptyList={transfersUnavailable
          ? <RecordListEmpty role={transfersStatus === 'error' ? 'alert' : 'status'} busy={transfersStatus === 'loading'}>{transfersStatus === 'error' ? <><p>No se pudieron cargar las operaciones recientes.</p><button type="button" onClick={onRetryTransfers}>Reintentar</button></> : <p>Cargando operaciones…</p>}</RecordListEmpty>
          : <RecordListEmpty><p>{transfers.length ? 'No hay operaciones con estos filtros.' : 'Todavía no hay operaciones.'}</p>{transfers.length > 0 && <button type="button" onClick={clearFilters}>Limpiar filtros</button>}</RecordListEmpty>}
        emptyDetail={transfersUnavailable
          ? <RecordDetailEmpty title={transfersStatus === 'error' ? 'Operaciones no disponibles' : 'Cargando…'} />
          : <RecordDetailEmpty title={transfers.length ? 'Sin resultados' : 'Cada envío, al detalle'} description={transfers.length ? 'Ajusta los filtros para consultar una operación.' : 'Aquí aparecerán el importe, el destinatario y el estado de tus operaciones.'}><Link href={transfers.length ? '/history' : primaryAction.href}>{transfers.length ? 'Ver historial completo' : primaryAction.label}<ArrowUpRight /></Link></RecordDetailEmpty>}
        tileAction={() => <RecordTileAction href="/transfers" label="Nuevo envío" />}
        footerAction={() => <TransferHistoryAction />}
      />
    </div>
  );
}
