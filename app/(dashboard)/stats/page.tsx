'use client';

import { MetricArea, MetricBars, MetricCard, MetricDesk, MetricTiles, ModuleMetrics, ModuleMetricsSkeleton } from '@/components/dashboard/module-metric-card';
import { CommissionsPanel, ReconciliationPanel } from '@/components/dashboard/panels/stats-record-panels';
import { RecentTransfersPanel } from '@/components/dashboard/transfer-record-panel';
import { dailySeries, shareOf } from '@/lib/dashboard-series';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getAgentTransferStats, getAgentsCommissionStats, getDashboardReconciliation, getDashboardStats, getDailyTransferStats, getRecentTransfers } from '@/services/dashboard';
import type { AgentTransferStats, AgentsCommissionStats, DashboardStats, DailyTransferStats, ReconciliationSummary, Transfer } from '@/types';
import { convertCurrency, formatCurrency, formatDateShort, formatMonthYear } from '@/lib/utils';
import { fetchJSON, HttpError } from '@/services/http';
import { isAdminRole, isSuperAdminRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import { ActivityBarChart, ShareRadialChart, type ShareRow } from '@/components/dashboard/stats-charts';
import { ArrowUpRight, CheckCircle2, Clock, TrendingUp } from '@/components/ui/hugeicons';

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

const settlementRateConfig = {
  value: { label: 'Liquidación', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const TOP_AGENTS_LIMIT = 5;


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
    date: item.date,
    amount: convertCurrency(item.total_amount, 'XAF', currency),
    count: item.transfer_count,
  }));

  const volumeTrend = dailySeries(dailyStats, (day) => convertCurrency(day.total_amount, 'XAF', currency));
  const ticketTrend = dailySeries(dailyStats, (day) => (day.transfer_count ? convertCurrency(day.total_amount / day.transfer_count, 'XAF', currency) : 0));
  const formatTrend = (value: number) => formatCurrency(value, currency);

  // Sin recorte: la tabla de comisiones del dashboard —retirada por estar
  // duplicada aquí— listaba a todos los gestores, y esta tarjeta se llama
  // «Comisiones por gestor», no «Top 5».
  const commissionAgents = commissionStats?.agents || [];

  const completedOps = stats?.completedTransfers ?? 0;
  const pendingOps = stats?.pendingTransfers ?? 0;
  const cancelledOps = stats?.cancelledTransfers ?? 0;
  const totalOps = completedOps + pendingOps + cancelledOps;
  const settlementRate = stats?.settlementRate ?? 0;

  // El endpoint ya entrega a los gestores de mayor a menor volumen.
  const leadingAgent = agentStats[0];
  const networkVolume = agentStats.reduce((sum, agent) => sum + agent.total_sent, 0);
  const leadingShare = shareOf(leadingAgent?.total_sent ?? 0, networkVolume);

  const statusRows: ShareRow[] = [
    { name: 'Completadas', value: String(completedOps), highlighted: true },
    { name: 'Pendientes', value: String(pendingOps) },
    { name: 'Canceladas', value: String(cancelledOps) },
  ].filter((row) => row.value !== '0');
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
        <ModuleMetricsSkeleton />
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
    // `md:`, `@4xl:` ≈ `lg:`, `@6xl:` ≈ `xl:`), según el ancho de la página.
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
            <div className="dashboard-inset rounded-2xl border px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Volumen 30 días</p>
              <p className="mt-1 text-xl font-black text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p>
            </div>
            <div className="dashboard-inset rounded-2xl border px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Tasa de cierre</p>
              <p className="mt-1 text-xl font-black text-foreground">{settlementRate}%</p>
            </div>
          </div>
        </div>
      </section>

      <ModuleMetrics label="Resumen de estadísticas">
        <MetricCard
          layout="desk"
          title="Operaciones"
          value={String(totalOps)}
          caption={<><span className="overview-tone-warning">{stats?.todayTransfers ?? 0}</span> registradas hoy</>}
        >
          <MetricDesk />
        </MetricCard>
        <MetricCard title="Volumen total" value={fmt(stats?.monthlyVolume ?? 0)} caption="Acumulado de 30 días">
          <MetricBars data={volumeTrend} seriesLabel="Volumen" format={formatTrend} />
        </MetricCard>
        <MetricCard title="Ticket promedio" value={fmt(stats?.averageTicket ?? 0)} caption="Promedio por envío completado">
          <MetricArea data={ticketTrend} seriesLabel="Ticket" format={formatTrend} legend="Ticket por día · 7 días" />
        </MetricCard>
        <MetricCard
          layout="tiles"
          title={isAdmin ? 'Gestores activos' : 'Clientes únicos'}
          value={String(isAdmin ? stats?.activeAgents ?? 0 : stats?.totalClients ?? 0)}
          caption={isAdmin ? 'Participando en la red' : 'Atendidos en el período'}
          action={{ href: '/history', label: 'Ver historial', icon: <ArrowUpRight /> }}
        >
          <MetricTiles tiles={[
            { icon: <CheckCircle2 />, title: 'Completas', detail: String(stats?.completedTransfers ?? 0) },
            { icon: <TrendingUp />, title: 'Cierre', detail: `${settlementRate} %`, featured: true },
            { icon: <Clock />, title: 'Pendientes', detail: String(stats?.pendingTransfers ?? 0) },
          ]} />
        </MetricCard>
      </ModuleMetrics>

      <section className="grid gap-6 @4xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <ActivityBarChart
          title="Flujo de volumen y actividad"
          description="Operaciones completadas en los últimos 30 días"
          data={chartData}
          formatAmount={formatTrend}
        >
          <div className="grid gap-4 @2xl:grid-cols-3">
            <div className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Semana actual</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{fmt(stats?.weeklyVolume ?? 0)}</p>
            </div>
            <div className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Hoy</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{fmt(stats?.todayVolume ?? 0)}</p>
            </div>
            <div className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Comisión media</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{fmt(stats?.commissionPerTransfer ?? 0)}</p>
            </div>
          </div>
        </ActivityBarChart>

        {isAdmin ? (
          <ShareRadialChart
            title="Distribución de red"
            description="Histórico de envíos completados"
            share={leadingShare}
            shareLabel="Gestor líder"
            summary={`${leadingAgent?.agent_name} concentra el ${leadingShare} % del volumen`}
            detail={`${agentStats.length} ${agentStats.length === 1 ? 'gestor' : 'gestores'} con envíos completados`}
            rows={agentStats.slice(0, TOP_AGENTS_LIMIT).map((agent, index) => ({
              name: agent.agent_name,
              value: fmt(agent.total_sent),
              detail: `${agent.transfer_count} operaciones`,
              highlighted: index === 0,
            }))}
          />
        ) : (
          <ShareRadialChart
            title="Distribución operativa"
            description="Estado de tus operaciones"
            share={shareOf(completedOps, totalOps)}
            shareLabel="Completadas"
            summary={`${completedOps} de ${totalOps} operaciones completadas`}
            detail={`${pendingOps} pendientes · ${cancelledOps} canceladas`}
            rows={statusRows}
          />
        )}
      </section>

      <section className="grid grid-cols-1 gap-6">
        <Card className="min-w-0">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="text-xl font-black text-foreground">
              Calidad operativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-5">
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

            <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-4">
              <div className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Pendientes</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{stats?.pendingTransfers ?? 0}</p>
              </div>
              <div className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Canceladas</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{stats?.cancelledTransfers ?? 0}</p>
              </div>
              <div className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Float utilizado</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{stats?.floatUtilization ?? 0}%</p>
              </div>
              <div className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
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

        {isAdmin ? (
          <CommissionsPanel
            agents={commissionAgents}
            monthCommission={commissionStats?.monthCommission ?? 0}
            yearCommission={commissionStats?.yearCommission ?? 0}
            format={fmt}
          />
        ) : (
          <RecentTransfersPanel
            title="Últimas operaciones observadas"
            transfers={recentTransfers}
            format={(amount, source) => formatCurrency(convertCurrency(amount, source, currency), currency)}
            emptyMessage="Todavía no hay operaciones."
            newTransfer={{ href: '/transfers' }}
          />
        )}
      </section>

      {isAdmin && (
        <section className="grid grid-cols-1 gap-6">
          <ReconciliationPanel
            periods={reconciliationPeriods.slice(0, 4)}
            totalNetFlow={reconciliation?.totalNetFlow}
            formatPeriod={formatPeriodLabel}
            format={fmt}
          />
        </section>
      )}
      {isSuperAdmin && marketingStats && (
        <section className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="min-w-0">
            <CardHeader className="border-b border-border/5 pb-5">
              <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
                <div>
                  <CardTitle className="text-xl font-black text-foreground">
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
                  <div key={label} className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
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
                  <div key={label} className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-5">
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
              <CardTitle className="text-xl font-black text-foreground">
                Actividad reciente de captación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {([
                ['Selección de audiencias', marketingStats.audienceSelections],
                ['Targets más usados', marketingStats.byTarget],
              ] as const).map(([label, items]) => (
                <div key={label} className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
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
                  <div className="dashboard-inset rounded-3xl border border-dashed border-border/20 bg-background/50 px-5 py-6 text-center text-sm font-semibold text-muted-foreground">
                    Aún no hay eventos recientes de marketing.
                  </div>
                ) : (
                  marketingStats.recent.map((event, index) => (
                    <div key={`${event.created_at}-${event.action}-${index}`} className="dashboard-inset rounded-3xl border border-border/10 bg-background/70 p-4">
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
