'use client';

import { useEffect, useState } from 'react';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { useAppStore } from '@/lib/store';
import { getAgentTransferStats, getDashboardStats, getDailyTransferStats, getRecentTransfers } from '@/services/dashboard';
import type { AgentTransferStats, DashboardStats, DailyTransferStats, Transfer } from '@/types';
import { cn, convertCurrency, formatCurrency, formatDateShort } from '@/lib/utils';
import { HttpError } from '@/services/http';
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
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';

type SupportRequestType = 'balance_topup' | 'report_error' | 'general';

const settlementRateConfig = {
  value: { label: 'Tasa de liquidación', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const pendingRateConfig = {
  value: { label: 'Pendientes', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const cancelledRateConfig = {
  value: { label: 'Canceladas', color: 'var(--chart-5)' },
} satisfies ChartConfig;

export default function DashboardPage() {
  const { user, preferredCurrency } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyTransferStats[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [agentStats, setAgentStats] = useState<AgentTransferStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportRequestType, setSupportRequestType] = useState<SupportRequestType>('general');

  const currency = preferredCurrency || 'XAF';
  const isAdmin = isAdminRole(user?.role);
  const isGestor = user?.role === 'gestor';
  const isClient = user?.role === 'cliente';

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, transfersData, dailyData, agentsData] = await Promise.all([
          getDashboardStats(),
          getRecentTransfers(8),
          isClient ? Promise.resolve([]) : getDailyTransferStats(14),
          isAdmin ? getAgentTransferStats() : Promise.resolve([]),
        ]);
        setStats(statsData);
        setRecentTransfers(transfersData);
        setDailyStats(dailyData);
        setAgentStats(agentsData);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) {
          console.error('Error loading dashboard data:', error);
        }
      } finally {
        setLoading(false);
      }
    }
    if (user) loadData();
  }, [user, isAdmin, isClient]);

  const fmt = (amount: number) => formatCurrency(convertCurrency(amount, 'XAF', currency), currency);
  const reservedBalance = stats?.reservedBalance ?? stats?.pendingExposure ?? 0;
  const totalStates = (stats?.completedTransfers ?? 0) + (stats?.pendingTransfers ?? 0) + (stats?.cancelledTransfers ?? 0);
  const settlementRate = stats?.settlementRate ?? 0;
  const pendingRate = totalStates ? Math.round(((stats?.pendingTransfers ?? 0) / totalStates) * 100) : 0;
  const cancelledRate = totalStates ? Math.round(((stats?.cancelledTransfers ?? 0) / totalStates) * 100) : 0;
  const primaryAction = isGestor ? { href: '/transfers', label: 'Nuevo envío', icon: Send } : isAdmin ? { href: '/balance', label: 'Gestionar tesorería', icon: Landmark } : { href: '/balance', label: 'Ver billetera', icon: Wallet };

  const additionalMetrics: { label: string; value: string; icon: React.ElementType; tone: string }[] = [
    { label: 'Volumen 30 días', value: fmt(stats?.monthlyVolume ?? 0), icon: BarChart3, tone: 'border-sky-500/20 bg-sky-500 shadow-sky-500/20' },
    { label: 'Ticket medio', value: fmt(stats?.averageTicket ?? 0), icon: Target, tone: 'border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20' },
    ...(isClient
      ? [{ label: 'Tasa de cancelación', value: `${cancelledRate}%`, icon: AlertTriangle, tone: 'border-rose-500/20 bg-rose-500 shadow-rose-500/20' }]
      : [
          { label: 'Recarga proyectada 24h', value: fmt(stats?.projectedTopups24h ?? 0), icon: TrendingUp, tone: 'border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20' },
          { label: 'Cobertura de float', value: `${(stats?.liquidityCoverageDays ?? 0).toFixed(1)} días`, icon: Gauge, tone: 'border-violet-500/20 bg-violet-500 shadow-violet-500/20' },
          { label: 'Utilización del float', value: `${stats?.floatUtilization ?? 0}%`, icon: Target, tone: 'border-amber-500/20 bg-amber-500 shadow-amber-500/20' },
        ]),
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-4xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <DashboardOverview stats={stats} dailyStats={dailyStats} transfers={recentTransfers} currency={currency} isClient={isClient} primaryAction={primaryAction}
        onSupport={() => { setSupportRequestType(isGestor ? 'balance_topup' : 'general'); setSupportModalOpen(true); }} />
      {/* Bandeja única: los KPIs, «Salud operativa» y «Top gestores» comparten
          una sola superficie oscura en vez de flotar sueltos sobre la página.
          El color lo pone `.dashboard-tray`, que reescribe los tokens para
          todo el subárbol. */}
      <section className="dashboard-tray" aria-label="Indicadores financieros y salud operativa">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><ShieldCheck className="h-5 w-5 text-primary" /> Salud operativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tasa de liquidación</p><p className="text-2xl font-bold text-foreground">{settlementRate}%</p></div>
              <div className="mt-4">
                <ChartContainer config={settlementRateConfig} className="h-3 w-full">
                  <BarChart accessibilityLayer data={[{ name: 'rate', value: Math.min(settlementRate, 100) }]} layout="vertical" margin={{ left: 0, right: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Bar dataKey="value" fill="var(--color-value)" radius={6} />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
            <div className="space-y-4 rounded-3xl border border-border/10 bg-background/70 p-5">
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Pendientes</span><span className="text-xs font-semibold text-amber-300">{pendingRate}%</span></div>
                <ChartContainer config={pendingRateConfig} className="h-2 w-full">
                  <BarChart accessibilityLayer data={[{ name: 'rate', value: Math.min(pendingRate, 100) }]} layout="vertical" margin={{ left: 0, right: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Bar dataKey="value" fill="var(--color-value)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Canceladas</span><span className="text-xs font-semibold text-rose-300">{cancelledRate}%</span></div>
                <ChartContainer config={cancelledRateConfig} className="h-2 w-full">
                  <BarChart accessibilityLayer data={[{ name: 'rate', value: Math.min(cancelledRate, 100) }]} layout="vertical" margin={{ left: 0, right: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Bar dataKey="value" fill="var(--color-value)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isAdmin ? 'Gestores activos' : isGestor ? 'Clientes atendidos' : 'Confirmadas'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isAdmin ? stats?.activeAgents ?? 0 : isGestor ? stats?.totalClients ?? 0 : stats?.completedTransfers ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Saldo retenido' : 'Bajo umbral'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? fmt(reservedBalance) : stats?.agentsBelowThreshold ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Pendientes' : 'Disponibles para pago'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? stats?.pendingTransfers ?? 0 : stats?.pickupReadyTransfers ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Ticket medio' : 'Clientes únicos'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? fmt(stats?.averageTicket ?? 0) : stats?.totalClients ?? 0}</p></div>
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
              {agentStats.length === 0 ? (
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
