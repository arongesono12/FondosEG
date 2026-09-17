'use client';

import { useEffect, useState } from 'react';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getAgentTransferStats, getAgentsCommissionStats, getDashboardStats, getDailyTransferStats, getRecentTransfers } from '@/services/dashboard';
import type { AgentTransferStats, AgentsCommissionStats, DashboardStats, DailyTransferStats, Transfer } from '@/types';
import { cn, convertCurrency, formatCurrency, formatDateShort } from '@/lib/utils';
import { fetchJSON, HttpError } from '@/services/http';
import { isAdminRole, isSuperAdminRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportModal } from '@/components/layout/support-modal';
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  ChevronDown,
  Coins,
  Gauge,
  Landmark,
  MousePointerClick,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from '@/components/ui/hugeicons';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type SupportRequestType = 'balance_topup' | 'report_error' | 'general';

const cashFlowConfig = {
  amount: { label: 'Volumen', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const settlementRateConfig = {
  value: { label: 'Tasa de liquidación', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const pendingRateConfig = {
  value: { label: 'Pendientes', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const cancelledRateConfig = {
  value: { label: 'Canceladas', color: 'var(--chart-5)' },
} satisfies ChartConfig;

type MarketingStatsResponse = {
  totals: {
    total_events: number;
    events_7d: number;
    events_30d: number;
    cta_clicks: number;
    form_submits: number;
    audience_switches: number;
  };
  byAudience: { label: string; count: number }[];
  byCta: { label: string; count: number }[];
  byTarget: { label: string; count: number }[];
  byTheme: { label: string; count: number }[];
  audienceSelections: { label: string; count: number }[];
  recent: {
    action: string;
    audience: string | null;
    cta: string | null;
    target: string | null;
    theme: string | null;
    created_at: string;
  }[];
};

export default function DashboardPage() {
  const { user, preferredCurrency } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyTransferStats[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [agentStats, setAgentStats] = useState<AgentTransferStats[]>([]);
  const [commissionStats, setCommissionStats] = useState<AgentsCommissionStats | null>(null);
  const [marketingStats, setMarketingStats] = useState<MarketingStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportRequestType, setSupportRequestType] = useState<SupportRequestType>('general');

  const currency = preferredCurrency || 'XAF';
  const isAdmin = isAdminRole(user?.role);
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const isGestor = user?.role === 'gestor';
  const isClient = user?.role === 'cliente';

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, transfersData, dailyData, agentsData, marketingData] = await Promise.all([
          getDashboardStats(),
          getRecentTransfers(8),
          isClient ? Promise.resolve([]) : getDailyTransferStats(14),
          isAdmin ? getAgentTransferStats() : Promise.resolve([]),
          isSuperAdmin ? fetchJSON<MarketingStatsResponse>('/api/marketing/stats') : Promise.resolve(null),
        ]);
        const commissionData = isAdmin ? await getAgentsCommissionStats() : null;
        setStats(statsData);
        setRecentTransfers(transfersData);
        setDailyStats(dailyData);
        setAgentStats(agentsData);
        setCommissionStats(commissionData);
        setMarketingStats(marketingData);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) {
          console.error('Error loading dashboard data:', error);
        }
      } finally {
        setLoading(false);
      }
    }
    if (user) loadData();
  }, [user, isAdmin, isClient, isSuperAdmin]);

  const fmt = (amount: number) => formatCurrency(convertCurrency(amount, 'XAF', currency), currency);
  const trend = dailyStats.slice(-7);

  const volumeTrend = trend.map((item) => ({
    date: formatDateShort(item.date).slice(0, 5),
    amount: Math.round(convertCurrency(item.total_amount, 'XAF', currency)),
  }));

  const reservedBalance = stats?.reservedBalance ?? stats?.pendingExposure ?? 0;
  const totalStates = (stats?.completedTransfers ?? 0) + (stats?.pendingTransfers ?? 0) + (stats?.cancelledTransfers ?? 0);
  const settlementRate = stats?.settlementRate ?? 0;
  const pendingRate = totalStates ? Math.round(((stats?.pendingTransfers ?? 0) / totalStates) * 100) : 0;
  const cancelledRate = totalStates ? Math.round(((stats?.cancelledTransfers ?? 0) / totalStates) * 100) : 0;
  const primaryAction = isGestor ? { href: '/transfers', label: 'Nuevo envío', icon: Send } : isAdmin ? { href: '/balance', label: 'Gestionar tesorería', icon: Landmark } : { href: '/balance', label: 'Ver billetera', icon: Wallet };

  const compactAmount = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
    return `${Math.round(value)}`;
  };

  const treasuryRows: { label: string; value: string; icon: React.ElementType; tone: string }[] = isClient
    ? [
        { label: 'Volumen 30 días', value: fmt(stats?.monthlyVolume ?? 0), icon: TrendingUp, tone: 'border-sky-500/20 bg-sky-500 shadow-sky-500/20' },
        { label: 'Confirmación', value: `${settlementRate}%`, icon: ShieldCheck, tone: 'border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20' },
        { label: 'Saldo retenido', value: fmt(reservedBalance), icon: Clock3, tone: 'border-amber-500/20 bg-amber-500 shadow-amber-500/20' },
        { label: 'Ticket medio', value: fmt(stats?.averageTicket ?? 0), icon: Target, tone: 'border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20' },
      ]
    : [
        { label: 'Capital operativo', value: fmt(stats?.totalBalance ?? 0), icon: Landmark, tone: 'border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20' },
        { label: 'Recarga proyectada 24h', value: fmt(stats?.projectedTopups24h ?? 0), icon: TrendingUp, tone: 'border-sky-500/20 bg-sky-500 shadow-sky-500/20' },
        { label: 'Cobertura de float', value: `${(stats?.liquidityCoverageDays ?? 0).toFixed(1)} días`, icon: Gauge, tone: 'border-violet-500/20 bg-violet-500 shadow-violet-500/20' },
        { label: 'Utilización del float', value: `${stats?.floatUtilization ?? 0}%`, icon: Target, tone: 'border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20' },
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
      <details className="dashboard-insights">
        <summary>Más información financiera y operativa <ChevronDown aria-hidden="true" /></summary>
        <div className="dashboard-insights-content">
      {/* Fila de gráficos: flujo de caja (área) + saldos y tesorería */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border/5 pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><TrendingUp className="h-5 w-5 text-primary" /> Flujo de caja</CardTitle>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {isClient ? 'Revisa el detalle y el histórico de tu actividad en el historial.' : 'Pulso de volumen de los últimos 7 días cerrados.'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/10 bg-background px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Promedio ticket</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmt(stats?.averageTicket ?? 0)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            {!isClient && trend.length > 0 ? (
              <div className="rounded-[1.75rem] border border-border/10 bg-background/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div><p className="text-sm font-bold text-foreground">Volumen diario</p><p className="text-xs font-medium text-muted-foreground">Últimos 7 días cerrados</p></div>
                  <div className="text-right"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Volumen 30 días</p><p className="text-lg font-bold text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p></div>
                </div>
                <ChartContainer config={cashFlowConfig} className="aspect-auto h-64 w-full min-w-0 sm:h-72">
                  <AreaChart accessibilityLayer data={volumeTrend} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      tickMargin={8}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: 'currentColor', fontWeight: 700 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={56}
                      tick={{ fontSize: 10, fill: 'currentColor', fontWeight: 700 }}
                      className="text-muted-foreground"
                      tickFormatter={(value: number) => compactAmount(value)}
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                    <defs>
                      <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-amount)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-amount)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area dataKey="amount" type="monotone" fill="url(#cashFlowFill)" stroke="var(--color-amount)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-border/20 bg-background/50 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Todavía no hay datos de flujo para mostrar. Revisa el histórico de tus operaciones.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><Landmark className="h-5 w-5 text-primary" /> Saldos y tesorería</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {treasuryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 rounded-3xl border border-border/10 bg-background/70 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-white shadow-lg', row.tone)}>
                    <row.icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-foreground">{row.label}</p>
                </div>
                <p className="shrink-0 text-lg font-bold tabular-nums text-foreground">{row.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Operativo: salud + top gestores/resumen + acciones rápidas */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
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
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Pendientes</span><span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{pendingRate}%</span></div>
                <ChartContainer config={pendingRateConfig} className="h-2 w-full">
                  <BarChart accessibilityLayer data={[{ name: 'rate', value: Math.min(pendingRate, 100) }]} layout="vertical" margin={{ left: 0, right: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Bar dataKey="value" fill="var(--color-value)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Canceladas</span><span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{cancelledRate}%</span></div>
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
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
                <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-bold uppercase tracking-[0.2em]">Atención de liquidez</p><p className="mt-1 text-sm font-medium">Hay {stats?.agentsBelowThreshold} gestor(es) por debajo del umbral operativo de 25.000 XAF.</p></div></div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">{isAdmin ? <Users className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}{isAdmin ? ' Top gestores por volumen' : ' Resumen ejecutivo'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {isAdmin ? agentStats.slice(0, 5).map((agent, index) => (
                <div key={agent.agent_id} className="flex items-center justify-between rounded-3xl border border-border/10 bg-background/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">#{index + 1}</div>
                    <div><p className="text-sm font-bold text-foreground">{agent.agent_name}</p><p className="text-xs font-medium text-muted-foreground">{agent.transfer_count} operaciones</p></div>
                  </div>
                  <div className="text-right"><p className="text-sm font-bold text-foreground">{fmt(agent.total_sent)}</p><p className="text-xs font-medium text-muted-foreground">{formatDateShort(agent.last_transfer)}</p></div>
                </div>
              )) : (
                <>
                  <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Volumen del mes</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p></div>
                  <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Meta de consistencia</p><div className="mt-3 flex items-center justify-between"><p className="text-2xl font-bold text-foreground">{settlementRate}%</p><Target className="h-5 w-5 text-emerald-500" /></div></div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><BarChart3 className="h-5 w-5 text-primary" /> Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              <Link href={isAdmin ? '/stats' : '/history'}><div className="rounded-3xl border border-border/10 bg-background/70 p-4 hover:bg-background"><p className="text-sm font-bold text-foreground">{isAdmin ? 'Analítica avanzada' : 'Historial operativo'}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{isAdmin ? 'Explora tendencia, red y concentración por gestor.' : 'Revisa operaciones, estados y fechas clave.'}</p></div></Link>
              <Link href="/balance"><div className="rounded-3xl border border-border/10 bg-background/70 p-4 hover:bg-background"><p className="text-sm font-bold text-foreground">{isAdmin ? 'Tesorería de red' : 'Mi liquidez'}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{isAdmin ? 'Recarga saldos y controla disponibilidad por gestor.' : 'Consulta movimientos y saldo operativo en tiempo real.'}</p></div></Link>
              <button type="button" className="rounded-3xl border border-border/10 bg-background/70 p-4 text-left hover:bg-background" onClick={() => { setSupportRequestType(isGestor ? 'balance_topup' : 'general'); setSupportModalOpen(true); }}>
                <p className="text-sm font-bold text-foreground">Escalar incidencia</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Contacta con administración para recargas, errores o seguimiento.</p>
              </button>
            </CardContent>
          </Card>
        </div>
      </section>

      {!isClient && (
        <section className="grid grid-cols-1 gap-6">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border/5 pb-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                    <Coins className="h-5 w-5 text-primary" /> Resumen de comisiones
                  </CardTitle>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    {isAdmin
                      ? 'Seguimiento de comisiones generadas por cada gestor.'
                      : 'Tus comisiones generadas por día, mes y año.'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {isAdmin ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Hoy</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(commissionStats?.todayCommission ?? 0)}</p>
                    </div>
                    <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">Mes actual</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(commissionStats?.monthCommission ?? 0)}</p>
                    </div>
                    <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">Año actual</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(commissionStats?.yearCommission ?? 0)}</p>
                    </div>
                    <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:text-fuchsia-300">Acumulado</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(commissionStats?.totalCommission ?? 0)}</p>
                    </div>
                  </div>

                  {/* Tabla en escritorio, lista de tarjetas etiquetadas por debajo de lg.
                      `lg:contents` saca el <dl> del flujo en escritorio y deja que sus
                      cuatro hijos ocupen directamente las columnas 2-5 de la rejilla. */}
                  <div className="overflow-hidden rounded-3xl border border-border/10 bg-background/70">
                    <div className="hidden grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] gap-3 border-b border-border/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:grid">
                      <span>Gestor</span>
                      <span className="text-right">Hoy</span>
                      <span className="text-right">Mes</span>
                      <span className="text-right">Año</span>
                      <span className="text-right">Acumulado</span>
                    </div>
                    <div className="divide-y divide-border/10">
                      {(commissionStats?.agents || []).length === 0 ? (
                        <div className="px-4 py-6 text-sm font-medium text-muted-foreground">
                          Todavía no hay comisiones registradas para mostrar.
                        </div>
                      ) : (
                        (commissionStats?.agents || []).map((agent) => (
                          <div
                            key={agent.agent_id}
                            className="px-4 py-4 text-sm lg:grid lg:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] lg:items-center lg:gap-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-foreground">{agent.agent_name}</p>
                              <p className="text-xs font-medium text-muted-foreground">{agent.transfer_count} envíos con comisión</p>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:mt-0 lg:contents">
                              {([
                                ['Hoy', agent.today_commission, 'text-foreground'],
                                ['Mes', agent.month_commission, 'text-foreground'],
                                ['Año', agent.year_commission, 'text-foreground'],
                                ['Acumulado', agent.total_commission, 'text-emerald-600'],
                              ] as const).map(([label, value, tone]) => (
                                <div key={label} className="min-w-0 lg:text-right">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:hidden">{label}</dt>
                                  <dd className={cn('truncate font-semibold tabular-nums', tone)}>{fmt(value)}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Hoy</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.todayCommission ?? 0)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Comisión generada hoy</p>
                  </div>
                  <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">Mes actual</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.monthlyCommission ?? 0)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Comisión acumulada del mes</p>
                  </div>
                  <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">Año actual</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.yearlyCommission ?? 0)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Comisión acumulada del año</p>
                  </div>
                  <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:text-fuchsia-300">Acumulado</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.totalCommission ?? 0)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Total histórico generado</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {isSuperAdmin && marketingStats && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border/5 pb-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                    <MousePointerClick className="h-5 w-5 text-primary" />
                    Rendimiento de la landing
                  </CardTitle>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    Interacciones por audiencia, CTA y formularios enviados desde la portada comercial.
                  </p>
                </div>
                <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                  Solo superadmin
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Eventos</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.total_events}</p>
                </div>
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">CTA clicks</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.cta_clicks}</p>
                </div>
                <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-700 dark:text-fuchsia-300">Form submits</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.form_submits}</p>
                </div>
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Cambios audiencia</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.audience_switches}</p>
                </div>
                <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">7 días</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.events_7d}</p>
                </div>
                <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">30 días</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.events_30d}</p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Audiencias</p>
                  <div className="mt-4 space-y-3">
                    {(marketingStats.byAudience.length ? marketingStats.byAudience : [{ label: 'Sin datos', count: 0 }]).map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Top CTA</p>
                  <div className="mt-4 space-y-3">
                    {(marketingStats.byCta.length ? marketingStats.byCta : [{ label: 'Sin datos', count: 0 }]).map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Temas usados</p>
                  <div className="mt-4 space-y-3">
                    {(marketingStats.byTheme.length ? marketingStats.byTheme : [{ label: 'Sin datos', count: 0 }]).map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <BarChart3 className="h-5 w-5 text-primary" />
                Actividad reciente de captación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selección de audiencias</p>
                <div className="mt-3 space-y-2">
                  {(marketingStats.audienceSelections.length ? marketingStats.audienceSelections : [{ label: 'Sin datos', count: 0 }]).map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Targets más usados</p>
                <div className="mt-3 space-y-2">
                  {(marketingStats.byTarget.length ? marketingStats.byTarget : [{ label: 'Sin datos', count: 0 }]).map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-foreground">{item.label}</span>
                      <span className="shrink-0 text-muted-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {marketingStats.recent.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-5 py-6 text-center text-sm font-semibold text-muted-foreground">
                    Aun no hay eventos recientes de marketing.
                  </div>
                ) : (
                  marketingStats.recent.map((event, index) => (
                    <div key={`${event.created_at}-${event.action}-${index}`} className="rounded-3xl border border-border/10 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-foreground">{event.cta || event.action}</p>
                        <Badge className="rounded-full bg-slate-900 px-2 py-1 text-xs uppercase tracking-[0.16em] text-white dark:bg-white dark:text-slate-900">
                          {event.audience || 'landing'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {event.target || 'sin target'} · {event.theme || 'theme n/d'} · {formatDateShort(event.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

        </div>
      </details>
      <SupportModal open={supportModalOpen} onOpenChange={setSupportModalOpen} requestType={supportRequestType} />
    </div>
  );
}
