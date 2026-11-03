'use client';

import { useId, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Area, AreaChart, Bar, BarChart, XAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import type { MetricPoint } from '@/lib/dashboard-series';
import { cn } from '@/lib/utils';

const METRIC_CARD_COUNT = 4;
const DEFAULT_FORMAT = (value: number): string => String(value);

/** El `.overview` exterior aporta a los módulos los mismos iconos y focos que al dashboard. */
export function ModuleMetrics({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overview">
      <section className="overview-metrics" aria-label={label}>{children}</section>
    </div>
  );
}

export function ModuleMetricsSkeleton() {
  return (
    <div className="overview-metrics">
      {Array.from({ length: METRIC_CARD_COUNT }, (_, index) => <Skeleton key={index} className="h-60.5" />)}
    </div>
  );
}

interface MetricAction {
  label: string;
  icon: ReactNode;
  href?: string;
  onSelect?: () => void;
}

interface MetricCardProps {
  title: string;
  value: ReactNode;
  caption: ReactNode;
  /** `desk` y `tiles` reservan abajo el hueco de su visual, que va anclado al borde. */
  layout?: 'chart' | 'desk' | 'tiles';
  action?: MetricAction;
  children?: ReactNode;
}

/** Tarjeta de indicador del dashboard: título, cifra, leyenda y un visual inferior. */
export function MetricCard({ title, value, caption, layout = 'chart', action, children }: MetricCardProps) {
  return (
    <DashboardCard asChild variant="metric">
      <article className={cn('overview-metric', layout === 'desk' && 'overview-metric-desk', layout === 'tiles' && 'overview-balance')}>
        <div className="overview-metric-label">
          <h2>{title}</h2>
          {action && <MetricCornerAction action={action} />}
        </div>
        <p className="overview-metric-value">{value}</p>
        <p className="overview-metric-caption">{caption}</p>
        {children}
      </article>
    </DashboardCard>
  );
}

function MetricCornerAction({ action }: { action: MetricAction }) {
  if (action.href) {
    return <Link href={action.href} aria-label={action.label} className="overview-icon-button">{action.icon}</Link>;
  }
  return <button type="button" onClick={action.onSelect} aria-label={action.label} className="overview-icon-button">{action.icon}</button>;
}

export function MetricDesk() {
  return (
    <div className="overview-desk">
      <Image src="/images/dashboard-desk.png" alt="" fill sizes="(max-width: 600px) 50vw, 25vw" />
    </div>
  );
}

interface MetricChartProps {
  data: MetricPoint[];
  seriesLabel: string;
  format?: (value: number) => string;
  /** Se muestra cuando no hay ningún punto que dibujar. */
  empty?: ReactNode;
}

function metricChartConfig(seriesLabel: string): ChartConfig {
  return { value: { label: seriesLabel, color: 'var(--chart-1)' } };
}

export function MetricBars({ data, seriesLabel, format = DEFAULT_FORMAT, empty }: MetricChartProps) {
  const gradientId = `metric-bars-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!data.length) return <>{empty ?? <MetricChartEmpty message="Sin datos todavía" />}</>;

  return (
    <ChartContainer config={metricChartConfig(seriesLabel)} className="overview-mini-chart aspect-auto">
      <BarChart accessibilityLayer data={data} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.28} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => format(Number(value))} />} />
        <Bar dataKey="value" fill={`url(#${gradientId})`} radius={[3, 3, 0, 0]} maxBarSize={17} />
      </BarChart>
    </ChartContainer>
  );
}

export function MetricArea({ data, seriesLabel, format = DEFAULT_FORMAT, empty, legend }: MetricChartProps & { legend: string }) {
  const gradientId = `metric-area-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!data.length) return <>{empty ?? <MetricChartEmpty message="Sin datos todavía" />}</>;

  return (
    <>
      <ChartContainer config={metricChartConfig(seriesLabel)} className="overview-mini-chart aspect-auto">
        {/* El margen inferior mantiene la línea por encima de la leyenda aunque la serie valga cero. */}
        <AreaChart accessibilityLayer data={data} margin={{ top: 16, bottom: 28, left: 5, right: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => format(Number(value))} />} />
          <Area dataKey="value" type="linear" fill={`url(#${gradientId})`} stroke="var(--chart-1)" strokeWidth={1.7} dot={{ r: 2.5, fill: 'var(--surface)', strokeWidth: 1.5 }} />
        </AreaChart>
      </ChartContainer>
      <span className="overview-chart-legend">{legend}</span>
    </>
  );
}

/** Marcador de los gráficos sin datos; `children` admite, por ejemplo, un botón de reintento. */
export function MetricChartEmpty({ message, alert = false, children }: { message: string; alert?: boolean; children?: ReactNode }) {
  return (
    <div className="overview-chart-empty" role={alert ? 'alert' : undefined}>
      <div className="overview-chart-placeholder" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
      </div>
      <span>{message}</span>
      {children}
    </div>
  );
}

export function MetricRate({ value, label }: { value: number; label: string }) {
  return (
    <div className="overview-rate">
      <span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
      <p>{label}</p>
    </div>
  );
}

export interface MetricTile {
  icon: ReactNode;
  title: string;
  detail: string;
  /** Nombre accesible cuando `title` y `detail` no bastan por sí solos. */
  label?: string;
  featured?: boolean;
  href?: string;
  onSelect?: () => void;
}

export function MetricTiles({ tiles }: { tiles: MetricTile[] }) {
  return (
    <div className="overview-wallets">
      {tiles.map((tile) => <MetricTileItem key={tile.title} tile={tile} />)}
    </div>
  );
}

function MetricTileItem({ tile }: { tile: MetricTile }) {
  const className = cn('overview-wallet', tile.featured && 'is-featured');
  const content = <>{tile.icon}<strong>{tile.title}</strong><span>{tile.detail}</span></>;

  if (tile.href) return <Link className={className} href={tile.href} aria-label={tile.label}>{content}</Link>;
  if (tile.onSelect) return <button type="button" className={className} onClick={tile.onSelect} aria-label={tile.label}>{content}</button>;
  return <div className={className}>{content}</div>;
}
