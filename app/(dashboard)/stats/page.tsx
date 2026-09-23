'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getAgentTransferStats, getAgentsCommissionStats, getDashboardReconciliation, getDashboardStats, getDailyTransferStats, getRecentTransfers } from '@/services/dashboard';
import type { AgentTransferStats, AgentsCommissionStats, DashboardStats, DailyTransferStats, ReconciliationSummary, Transfer } from '@/types';
import { cn, convertCurrency, formatCurrency, formatDateShort, formatMonthYear, getStatusColor } from '@/lib/utils';
import { fetchJSON, HttpError } from '@/services/http';
import { isAdminRole, isSuperAdminRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  ArrowUpRight,
  BarChart3,
  CreditCard,
  MousePointerClick,
  PieChart as PieChartIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from '@/components/ui/hugeicons';

// Captación de la portada comercial. Vive aquí y no en el dashboard porque
// /stats ya es la pantalla de analítica y sólo abre para admin.
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

const lineChartConfig = {
  amount: { label: 'Volumen', color: 'var(--chart-1)' },
  count: { label: 'Operaciones', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const settlementRateConfig = {
  value: { label: 'Liquidación', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const PIE_COLOR_VARS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function StatChip({
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
    <Card className="min-w-0">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border text-white shadow-lg', tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="text-[clamp(1.125rem,1.4vw+0.75rem,1.5rem)] font-black leading-tight tabular-nums text-foreground">{value}</p>
          <p className="text-xs font-semibold text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const { user, preferredCurrency } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyTransferStats[]>([]);
  const [agentStats, setAgentStats] = useState<AgentTransferStats[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [commissionStats, setCommissionStats] = useState<AgentsCommissionStats | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [marketingStats, setMarketingStats] = useState<MarketingStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = isAdminRole(user?.role);
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const isGestor = user?.role === 'gestor';
  const currency = preferredCurrency || 'XAF';

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, dailyData, recentData, agentsData, commissionData, reconciliationData, marketingData] = await Promise.all([
          getDashboardStats(),
          getDailyTransferStats(30),
          getRecentTransfers(8),
          isAdmin ? getAgentTransferStats() : Promise.resolve([]),
          isAdmin ? getAgentsCommissionStats() : Promise.resolve(null),
          isAdmin ? getDashboardReconciliation(4) : Promise.resolve(null),
          isSuperAdmin ? fetchJSON<MarketingStatsResponse>('/api/marketing/stats') : Promise.resolve(null),
        ]);

        setStats(statsData);
        setDailyStats(dailyData);
        setRecentTransfers(recentData);
        setAgentStats(agentsData);
        setCommissionStats(commissionData);
        setReconciliation(reconciliationData);
        setMarketingStats(marketingData);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) {
          console.error('Error loading stats:', error);
        }
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user, isAdmin, isSuperAdmin]);

  const fmt = (amount: number) => formatCurrency(convertCurrency(amount, 'XAF', currency), currency);

  const chartData = dailyStats.map((item) => ({
    date: formatDateShort(item.date).slice(0, 5),
    amount: Math.round(convertCurrency(item.total_amount, 'XAF', currency)),
    count: item.transfer_count,
    agents: item.agent_count,
  }));

  const statusData: { name: string; value: number; ops?: number }[] = [
    { name: 'Completadas', value: stats?.completedTransfers ?? 0 },
    { name: 'Pendientes', value: stats?.pendingTransfers ?? 0 },
    { name: 'Canceladas', value: stats?.cancelledTransfers ?? 0 },
  ].filter((item) => item.value > 0);

  const concentrationData: { name: string; value: number; ops?: number }[] = (isAdmin ? agentStats : []).slice(0, 5).map((agent) => ({
    name: agent.agent_name,
    value: Math.round(convertCurrency(agent.total_sent, 'XAF', currency)),
    ops: agent.transfer_count,
  }));
  // Sin recorte: la tabla de comisiones del dashboard —retirada por estar
  // duplicada aquí— listaba a todos los gestores, y esta tarjeta se llama
  // «Comisiones por gestor», no «Top 5».
  const commissionAgents = commissionStats?.agents || [];

  const totalOps = (stats?.completedTransfers ?? 0) + (stats?.pendingTransfers ?? 0) + (stats?.cancelledTransfers ?? 0);
  const settlementRate = stats?.settlementRate ?? 0;
  const reconciliationPeriods = reconciliation?.periods ?? [];

  const formatPeriodLabel = (period: string) => {
    const [year, month] = period.split('-').map(Number);
    if (!year || !month) return period;
    return formatMonthYear(new Date(Date.UTC(year, month - 1, 1)), 'short');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-4xl" />
        <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!isAdmin && !isGestor) {
    return (
      <div className="space-y-6">
        <section className="app-card p-8">
          <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            Analítica disponible para operación
          </Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">Estadísticas operativas</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Esta vista avanzada está orientada a dirección y gestores. Desde tu perfil puedes seguir saldo, movimientos y confirmaciones de forma clara.
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild className="rounded-2xl bg-brand-gradient px-6 font-black text-white">
              <Link href="/dashboard">Volver al panel</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl px-6 font-black">
              <Link href="/history">Ver historial</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    // Las rejillas usan variantes de contenedor (`@xl:` ≈ `sm:`, `@2xl:` ≈
    // `md:`, `@4xl:` ≈ `lg:`, `@6xl:` ≈ `xl:`): la página también se pinta en
    // el panel de media pantalla, y a 1024px de viewport ese panel sólo deja
    // ~470px de ancho útil aunque `lg:` ya se hubiera disparado.
    <div className="space-y-8">
      <section className="app-card p-6 @2xl:p-8">
        <div className="flex flex-col gap-5 @4xl:flex-row @4xl:items-end @4xl:justify-between">
          <div className="max-w-3xl">
            <Badge className="rounded-full border border-white/30 bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              {isAdmin ? 'Dirección analítica' : 'Analítica del gestor'}
            </Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">
              Inteligencia de volumen y desempeño
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
              {isAdmin
                ? 'Lectura ejecutiva de tendencia, concentración por gestor, eficiencia operativa y desempeño reciente de la red.'
                : 'Tu rendimiento operativo en 30 días: ritmo de envíos, volumen, estabilidad y eficiencia de cierre.'}
            </p>
          </div>

          <div className="grid gap-3 @xl:grid-cols-2">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">Volumen 30 días</p>
              <p className="mt-1 text-xl font-black text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Tasa de cierre</p>
              <p className="mt-1 text-xl font-black text-foreground">{settlementRate}%</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-4">
        <StatChip label="Volumen total" value={fmt(stats?.monthlyVolume ?? 0)} hint="Acumulado de 30 días" icon={TrendingUp} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
        <StatChip label="Operaciones" value={String(totalOps)} hint={`${stats?.todayTransfers ?? 0} registradas hoy`} icon={BarChart3} tone="border-indigo-500/20 bg-indigo-500 shadow-indigo-500/20" />
        <StatChip label="Ticket promedio" value={fmt(stats?.averageTicket ?? 0)} hint="Promedio por envío completado" icon={CreditCard} tone="border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20" />
        <StatChip label={isAdmin ? 'Gestores activos' : 'Clientes únicos'} value={String(isAdmin ? stats?.activeAgents ?? 0 : stats?.totalClients ?? 0)} hint={isAdmin ? 'Participando en la red' : 'Atendidos en el período'} icon={Users} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
      </section>

      <section className="grid gap-6 @4xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <Card className="min-w-0">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <BarChart3 className="h-5 w-5 text-primary" />
              Flujo de volumen y actividad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="h-64 w-full min-w-0 @xl:h-80">
              <ChartContainer config={lineChartConfig} className="aspect-auto h-full w-full">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148,163,184,0.18)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 800 }} axisLine={false} tickLine={false} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 800 }} axisLine={false} tickLine={false} className="text-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="amount" stroke="var(--color-amount)" strokeWidth={3.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ChartContainer>
            </div>

            <div className="grid gap-4 @2xl:grid-cols-3">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Semana actual</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{fmt(stats?.weeklyVolume ?? 0)}</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Hoy</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{fmt(stats?.todayVolume ?? 0)}</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Comisión media</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{fmt(stats?.commissionPerTransfer ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <PieChartIcon className="h-5 w-5 text-primary" />
              {isAdmin ? 'Distribución de red' : 'Distribución operativa'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="h-64 min-w-0 @xl:h-72">
              <ChartContainer
                config={{
                  value: { label: 'Valor' },
                }}
                className="aspect-square h-full w-full"
              >
                <PieChart>
                  <Pie
                    data={isAdmin ? concentrationData : statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    // Radios relativos: con 62/104px fijos el anillo se salía del lienzo
                    // cuando la tarjeta estrechaba (panel de media pantalla, teléfono).
                    innerRadius="55%"
                    outerRadius="90%"
                    paddingAngle={4}
                  >
                    {(isAdmin ? concentrationData : statusData).map((_, index) => (
                      <Cell key={index} fill={PIE_COLOR_VARS[index % PIE_COLOR_VARS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                </PieChart>
              </ChartContainer>
            </div>

            <div className="space-y-3">
              {(isAdmin ? concentrationData : statusData).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl border border-border/10 bg-background/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLOR_VARS[index % PIE_COLOR_VARS.length] }} />
                    <div>
                      <p className="text-sm font-black text-foreground">{item.name}</p>
                      {item.ops !== undefined && <p className="text-xs font-semibold text-muted-foreground">{item.ops} operaciones</p>}
                    </div>
                  </div>
                  <p className="text-sm font-black text-foreground">{isAdmin ? fmt(item.value) : item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 @4xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="min-w-0">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Calidad operativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Liquidación</p>
                <p className="text-2xl font-black text-foreground">{settlementRate}%</p>
              </div>
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

            <div className="grid gap-3 @xl:grid-cols-2">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Pendientes</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{stats?.pendingTransfers ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Canceladas</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{stats?.cancelledTransfers ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Float utilizado</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{stats?.floatUtilization ?? 0}%</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Cobertura</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{(stats?.liquidityCoverageDays ?? 0).toFixed(1)} días</p>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full rounded-2xl font-black">
              <Link href="/dashboard">
                Volver al panel
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              {isAdmin ? 'Comisiones por gestor' : 'Últimas operaciones observadas'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {isAdmin && (
              <div className="grid gap-3 @xl:grid-cols-2">
                <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Mes actual</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{fmt(commissionStats?.monthCommission ?? 0)}</p>
                </div>
                <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Año actual</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{fmt(commissionStats?.yearCommission ?? 0)}</p>
                </div>
              </div>
            )}
            {isAdmin ? (
              commissionAgents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-6 py-10 text-center">
                  <p className="text-sm font-bold text-muted-foreground">No hay datos de comisión todavía.</p>
                </div>
              ) : (
                commissionAgents.map((agent) => (
                  <div key={agent.agent_id} className="rounded-3xl border border-border/10 bg-background/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-foreground">{agent.agent_name}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {agent.transfer_count} operaciones
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Costo est. {fmt(agent.estimated_cost)} · margen {agent.net_margin}%
                        </p>
                      </div>
                      <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-700">
                        Neto estimado
                      </Badge>
                    </div>
                    <div className="mt-4">
                      <p className="text-lg font-black text-foreground">{fmt(agent.net_profit)}</p>
                    </div>
                    {/* Las cuatro columnas que tenía la tabla del dashboard. */}
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/10 pt-3 @xl:grid-cols-4">
                      {([
                        ['Hoy', agent.today_commission],
                        ['Mes', agent.month_commission],
                        ['Año', agent.year_commission],
                        ['Acumulado', agent.total_commission],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
                          <dd className="mt-1 truncate font-semibold tabular-nums text-foreground">{fmt(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))
              )
            ) : (
              recentTransfers.map((transfer) => (
                <div key={transfer.id} className="rounded-3xl border border-border/10 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-foreground">{transfer.transfer_code}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {transfer.sender_name} · {transfer.receiver_name}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {transfer.destination_city} · {formatDateShort(transfer.created_at)}
                      </p>
                    </div>
                    <Badge className={cn('rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em]', getStatusColor(transfer.status))}>
                      {transfer.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-lg font-black text-foreground">{fmt(transfer.amount)}</p>
                    <Button asChild variant="ghost" className="rounded-xl font-bold text-muted-foreground hover:text-foreground">
              <Link href="/history">
                        Ver historial
                      </Link>
            </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {isAdmin && (
        <section className="grid gap-6">
          <Card className="min-w-0">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Conciliación mensual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {reconciliationPeriods.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-6 py-10 text-center">
                  <p className="text-sm font-bold text-muted-foreground">No hay movimientos suficientes para conciliar.</p>
                </div>
              ) : (
                reconciliationPeriods.slice(0, 4).map((period) => (
                  <div key={period.period} className="rounded-3xl border border-border/10 bg-background/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-foreground">{formatPeriodLabel(period.period)}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Topups {fmt(period.topups)} · Salidas {fmt(period.transfersOutflow)}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Ajustes {fmt(period.resets)} · Reembolsos {fmt(period.refunds)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-foreground">{fmt(period.netFlow)}</p>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{period.transactionCount} movimientos</p>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {reconciliation && (
                <div className="rounded-2xl border border-border/10 bg-background/70 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Neto del período</p>
                    <p className="text-base font-black text-foreground">{fmt(reconciliation.totalNetFlow)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
      {isSuperAdmin && marketingStats && (
        <section className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="min-w-0">
            <CardHeader className="border-b border-border/5 pb-5">
              <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
                    <MousePointerClick className="h-5 w-5 text-primary" />
                    Rendimiento de la landing
                  </CardTitle>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    Interacciones por audiencia, CTA y formularios enviados desde la portada comercial.
                  </p>
                </div>
                <Badge className="rounded-full border border-border/20 bg-background/70 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Solo superadmin
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-4 @2xl:grid-cols-3 @6xl:grid-cols-6">
                {([
                  ['Eventos', marketingStats.totals.total_events],
                  ['CTA clicks', marketingStats.totals.cta_clicks],
                  ['Form submits', marketingStats.totals.form_submits],
                  ['Cambios audiencia', marketingStats.totals.audience_switches],
                  ['7 días', marketingStats.totals.events_7d],
                  ['30 días', marketingStats.totals.events_30d],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-3xl border border-border/10 bg-background/70 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 @4xl:grid-cols-3">
                {([
                  ['Audiencias', marketingStats.byAudience],
                  ['Top CTA', marketingStats.byCta],
                  ['Temas usados', marketingStats.byTheme],
                ] as const).map(([label, items]) => (
                  <div key={label} className="rounded-3xl border border-border/10 bg-background/70 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <div className="mt-4 space-y-3">
                      {(items.length ? items : [{ label: 'Sin datos', count: 0 }]).map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-semibold text-foreground">{item.label}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
                <BarChart3 className="h-5 w-5 text-primary" />
                Actividad reciente de captación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {([
                ['Selección de audiencias', marketingStats.audienceSelections],
                ['Targets más usados', marketingStats.byTarget],
              ] as const).map(([label, items]) => (
                <div key={label} className="rounded-3xl border border-border/10 bg-background/70 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <div className="mt-3 space-y-2">
                    {(items.length ? items : [{ label: 'Sin datos', count: 0 }]).map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-semibold text-foreground">{item.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-3">
                {marketingStats.recent.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-5 py-6 text-center text-sm font-semibold text-muted-foreground">
                    Aún no hay eventos recientes de marketing.
                  </div>
                ) : (
                  marketingStats.recent.map((event, index) => (
                    <div key={`${event.created_at}-${event.action}-${index}`} className="rounded-3xl border border-border/10 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-black text-foreground">{event.cta || event.action}</p>
                        <Badge className="shrink-0 rounded-full border border-border/20 bg-background/70 px-2 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
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
  );
}
