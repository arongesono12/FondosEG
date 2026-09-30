'use client';

import { useState } from 'react';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { useAppStore } from '@/lib/store';
import { getAgentTransferStats, getDashboardStats, getDailyTransferStats, getRecentTransfers } from '@/services/dashboard';
import { cn, convertCurrency, formatCurrency, formatDateShort } from '@/lib/utils';
import { useRemoteBlock } from '@/lib/use-remote-block';
import { isAdminRole } from '@/lib/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportModal } from '@/components/layout/support-modal';
import {
  AlertTriangle,
  BarChart3,
  Gauge,
  Landmark,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from '@/components/ui/hugeicons';
type SupportRequestType = 'balance_topup' | 'report_error' | 'general';

export default function DashboardPage() {
  const { user, preferredCurrency } = useAppStore();
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportRequestType, setSupportRequestType] = useState<SupportRequestType>('general');

  const currency = preferredCurrency || 'XAF';
  const isAdmin = isAdminRole(user?.role);
  const isGestor = user?.role === 'gestor';
  const isClient = user?.role === 'cliente';

  // Cada bloque se carga y falla por separado: un error en una consulta no
  // borra el resto ni se presenta como un cero.
  const userKey = user?.id ?? null;
  const statsBlock = useRemoteBlock(userKey, getDashboardStats, 'dashboard stats');
  const transfersBlock = useRemoteBlock(userKey, () => getRecentTransfers(8), 'recent transfers');
  const dailyBlock = useRemoteBlock(userKey && !isClient ? userKey : null, () => getDailyTransferStats(14), 'daily transfer stats');
  const agentsBlock = useRemoteBlock(userKey && isAdmin ? userKey : null, getAgentTransferStats, 'agent transfer stats');

  const stats = statsBlock.data;
  const agentStats = agentsBlock.data ?? [];
  const fmt = (amount: number) => formatCurrency(convertCurrency(amount, 'XAF', currency), currency);
  // Sin datos de stats no hay cifra que mostrar: «—», nunca 0.
  const money = (amount: number | undefined) => (stats ? fmt(amount ?? 0) : '—');
  const count = (value: number | undefined) => (stats ? String(value ?? 0) : '—');
  const percent = (value: number) => (stats ? `${value}%` : '—');
  const reservedBalance = stats?.reservedBalance ?? stats?.pendingExposure;
  const totalStates = (stats?.completedTransfers ?? 0) + (stats?.pendingTransfers ?? 0) + (stats?.cancelledTransfers ?? 0);
  const settlementRate = stats?.settlementRate ?? 0;
  const pendingRate = totalStates ? Math.round(((stats?.pendingTransfers ?? 0) / totalStates) * 100) : 0;
  const cancelledRate = totalStates ? Math.round(((stats?.cancelledTransfers ?? 0) / totalStates) * 100) : 0;
  const primaryAction = isGestor ? { href: '/transfers', label: 'Nuevo envío', icon: Send } : isAdmin ? { href: '/balance', label: 'Gestionar tesorería', icon: Landmark } : { href: '/balance', label: 'Ver billetera', icon: Wallet };

  const additionalMetrics: { label: string; value: string; icon: React.ElementType; tone: string }[] = [
    { label: 'Volumen 30 días', value: money(stats?.monthlyVolume), icon: BarChart3, tone: 'border-sky-500/20 bg-sky-500 shadow-sky-500/20' },
    { label: 'Ticket medio', value: money(stats?.averageTicket), icon: Target, tone: 'border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20' },
    ...(isClient
      ? [{ label: 'Tasa de cancelación', value: percent(cancelledRate), icon: AlertTriangle, tone: 'border-rose-500/20 bg-rose-500 shadow-rose-500/20' }]
      : [
          { label: 'Recarga proyectada 24h', value: money(stats?.projectedTopups24h), icon: TrendingUp, tone: 'border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20' },
          { label: 'Cobertura de float', value: stats ? `${(stats.liquidityCoverageDays ?? 0).toFixed(1)} días` : '—', icon: Gauge, tone: 'border-violet-500/20 bg-violet-500 shadow-violet-500/20' },
          { label: 'Utilización del float', value: percent(stats?.floatUtilization ?? 0), icon: Target, tone: 'border-amber-500/20 bg-amber-500 shadow-amber-500/20' },
        ]),
  ];

  // Esqueleto de página solo en la primera carga de los indicadores; después
  // cada bloque gestiona su propio estado.
  if (!user || (statsBlock.status === 'loading' && !stats)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-4xl" />
        <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      {statsBlock.status === 'error' && (
        <BlockError
          message={stats
            ? `No se pudieron actualizar los indicadores. Se muestran los datos de las ${formatTime(statsBlock.updatedAt)}.`
            : 'No se pudieron cargar los indicadores. Las cifras aparecen como «—» hasta recuperarlas; no significan saldo cero.'}
          onRetry={statsBlock.reload}
        />
      )}
      <DashboardOverview stats={stats} dailyStats={dailyBlock.data ?? []} dailyStatus={dailyBlock.status} onRetryDaily={dailyBlock.reload}
        transfers={transfersBlock.data ?? []} transfersStatus={transfersBlock.status} onRetryTransfers={transfersBlock.reload}
        currency={currency} isClient={isClient} primaryAction={primaryAction}
        onSupport={() => { setSupportRequestType(isGestor ? 'balance_topup' : 'general'); setSupportModalOpen(true); }} />
      {/* Bandeja única: los KPIs, «Salud operativa» y «Top gestores» comparten
          una sola superficie oscura en vez de flotar sueltos sobre la página.
          El color lo pone `.dashboard-tray`, que reescribe los tokens para
          todo el subárbol. */}
      <section className="dashboard-tray" aria-label="Indicadores financieros y salud operativa">
      <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-5">
        {additionalMetrics.map((metric) => {
          const MetricIcon = metric.icon;

          return (
            <Card key={metric.label} className="min-w-0 overflow-hidden">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 truncate text-2xl font-bold tabular-nums text-foreground">{metric.value}</p>
                </div>
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-white shadow-lg', metric.tone)}>
                  <MetricIcon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!isClient && (
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><ShieldCheck className="h-5 w-5 text-primary" /> Salud operativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tasa de liquidación</p><p className="text-2xl font-bold text-foreground">{percent(settlementRate)}</p></div>
              <div className="mt-4">
                <RateMeter label="Tasa de liquidación" value={settlementRate} known={!!stats} color="var(--chart-3)" className="h-3" />
              </div>
            </div>
            <div className="space-y-4 rounded-3xl border border-border/10 bg-background/70 p-5">
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Pendientes</span><span className="text-xs font-semibold text-amber-300">{percent(pendingRate)}</span></div>
                <RateMeter label="Pendientes" value={pendingRate} known={!!stats} color="var(--chart-4)" className="h-2" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Canceladas</span><span className="text-xs font-semibold text-rose-300">{percent(cancelledRate)}</span></div>
                <RateMeter label="Canceladas" value={cancelledRate} known={!!stats} color="var(--chart-5)" className="h-2" />
              </div>
            </div>
            <div className="grid gap-3 @xl:grid-cols-2">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isAdmin ? 'Gestores activos' : isGestor ? 'Clientes atendidos' : 'Confirmadas'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{count(isAdmin ? stats?.activeAgents : isGestor ? stats?.totalClients : stats?.completedTransfers)}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Saldo retenido' : 'Bajo umbral'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? money(reservedBalance) : count(stats?.agentsBelowThreshold)}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Pendientes' : 'Disponibles para pago'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{count(isClient ? stats?.pendingTransfers : stats?.pickupReadyTransfers)}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Ticket medio' : 'Clientes únicos'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? money(stats?.averageTicket) : count(stats?.totalClients)}</p></div>
            </div>
            {!isClient && (stats?.agentsBelowThreshold ?? 0) > 0 && (
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
                <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-bold uppercase tracking-[0.2em]">Atención de liquidez</p><p className="mt-1 text-sm font-medium">Hay {stats?.agentsBelowThreshold} gestor(es) por debajo del umbral operativo de 25.000 XAF.</p></div></div>
              </div>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><Users className="h-5 w-5 text-primary" /> Top gestores por volumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {agentsBlock.status === 'error' && !agentsBlock.data ? (
                <BlockError message="No se pudo cargar el ranking de gestores." onRetry={agentsBlock.reload} />
              ) : agentsBlock.status === 'loading' && !agentsBlock.data ? (
                <div className="space-y-3" aria-busy="true"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
              ) : agentStats.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-border/20 p-5 text-sm font-medium text-muted-foreground">Todavía no hay actividad de gestores para mostrar.</p>
              ) : agentStats.slice(0, 5).map((agent, index) => (
                <div key={agent.agent_id} className="flex items-center justify-between rounded-3xl border border-border/10 bg-background/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-900">#{index + 1}</div>
                    <div><p className="text-sm font-bold text-foreground">{agent.agent_name}</p><p className="text-xs font-medium text-muted-foreground">{agent.transfer_count} operaciones</p></div>
                  </div>
                  <div className="text-right"><p className="text-sm font-bold text-foreground">{fmt(agent.total_sent)}</p><p className="text-xs font-medium text-muted-foreground">{formatDateShort(agent.last_transfer)}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
      )}
      </section>

      <SupportModal open={supportModalOpen} onOpenChange={setSupportModalOpen} requestType={supportRequestType} />
    </div>
  );
}

function formatTime(date: Date | null) {
  return date ? date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function BlockError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-medium text-rose-700 dark:text-rose-200">
      <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>
      <button type="button" onClick={onRetry} className="rounded-full border border-current px-4 py-1.5 text-xs font-semibold">Reintentar</button>
    </div>
  );
}

/**
 * Barra de porcentaje. Antes eran tres BarChart de Recharts con un único
 * valor: el mismo resultado en HTML/CSS, sin cargar la librería de gráficos.
 */
function RateMeter({ label, value, known, color, className }: { label: string; value: number; known: boolean; color: string; className?: string }) {
  const clamped = Math.max(0, Math.min(value, 100));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? clamped : undefined}
      aria-valuetext={known ? `${clamped}%` : 'No disponible'}
      className={cn('w-full overflow-hidden rounded-full bg-muted/40', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${known ? clamped : 0}%`, background: color }}
      />
    </div>
  );
}
