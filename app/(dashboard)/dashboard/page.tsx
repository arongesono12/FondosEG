'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getAgentTransferStats, getAgentsCommissionStats, getDashboardStats, getDailyTransferStats, getRecentTransfers } from '@/services/dashboard';
import type { AgentTransferStats, AgentsCommissionStats, DashboardStats, DailyTransferStats, Transfer } from '@/types';
import { cn, convertCurrency, formatCurrency, formatDateShort, getInitials, getStatusColor } from '@/lib/utils';
import { fetchJSON, HttpError } from '@/services/http';
import { isAdminRole, isSuperAdminRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportModal } from '@/components/layout/support-modal';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Clock3,
  CreditCard,
  Coins,
  Gauge,
  History,
  Landmark,
  LifeBuoy,
  MousePointerClick,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

type SupportRequestType = 'balance_topup' | 'report_error' | 'general';

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
            <p className="text-[clamp(1.125rem,1.4vw+0.75rem,1.5rem)] font-bold leading-tight tabular-nums text-foreground">{value}</p>
            <p className="text-xs font-medium text-muted-foreground">{hint}</p>
          </div>
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border text-white shadow-lg', tone)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function statusLabel(status: Transfer['status']) {
  switch (status) {
    case 'available_for_pickup': return 'Disponible';
    case 'paid_out': return 'Pagada';
    case 'completed': return 'Completada';
    case 'cancelled': return 'Cancelada';
    default: return 'Creada';
  }
}

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
  const availableBalance = stats?.availableBalance ?? stats?.totalBalance ?? 0;
  const reservedBalance = stats?.reservedBalance ?? stats?.pendingExposure ?? 0;
  const totalStates = (stats?.completedTransfers ?? 0) + (stats?.pendingTransfers ?? 0) + (stats?.cancelledTransfers ?? 0);
  const settlementRate = stats?.settlementRate ?? 0;
  const pendingRate = totalStates ? Math.round(((stats?.pendingTransfers ?? 0) / totalStates) * 100) : 0;
  const cancelledRate = totalStates ? Math.round(((stats?.cancelledTransfers ?? 0) / totalStates) * 100) : 0;
  const trend = dailyStats.slice(-7);
  const maxTrend = Math.max(...trend.map((item) => item.total_amount), 1);
  const primaryAction = isGestor ? { href: '/transfers', label: 'Nuevo envío', icon: Send } : isAdmin ? { href: '/balance', label: 'Gestionar tesorería', icon: Landmark } : { href: '/balance', label: 'Ver billetera', icon: Wallet };
  const PrimaryIcon = primaryAction.icon;

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
    <div className="space-y-6 md:space-y-8">
      <section className="rounded-4xl border border-border/10 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(248,250,252,0.72))] p-6 shadow-2xl shadow-slate-200/40 backdrop-blur-xl dark:bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.82))] dark:shadow-black/20 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <Badge className="w-fit rounded-full border border-white/30 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              {isAdmin ? 'Dirección' : isGestor ? 'Gestor' : 'Cliente'} x FondosEG
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Dashboard financiero y operativo</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground md:text-base">
                {isAdmin ? 'Liquidez, exposición, red y rentabilidad en una sola lectura.' : isGestor ? 'Control diario de float, volumen, cierres y ritmo operativo.' : 'Seguimiento claro de saldo, operaciones y confirmaciones de tu billetera.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Volumen hoy</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{fmt(stats?.todayVolume ?? 0)}</p>
                </div>
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">Cobertura</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{(stats?.liquidityCoverageDays ?? 0).toFixed(1)} días</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Utilización</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{stats?.floatUtilization ?? 0}%</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild className="h-14 w-full rounded-2xl bg-brand-gradient px-6 text-base font-bold text-white shadow-xl shadow-pink-500/20 hover:scale-[1.01]">
              <Link href={primaryAction.href}>
                <PrimaryIcon className="mr-2 h-5 w-5" />
                {primaryAction.label}
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-border/20 bg-white/60 px-6 text-base font-bold backdrop-blur-md dark:bg-white/5"
              onClick={() => {
                setSupportRequestType(isGestor ? 'balance_topup' : 'general');
                setSupportModalOpen(true);
              }}
            >
              <LifeBuoy className="mr-2 h-5 w-5" />
              Soporte
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title={isClient ? 'Saldo disponible' : 'Float disponible'} value={fmt(availableBalance)} hint={isClient ? 'Fondos listos para usar' : 'Liquidez inmediata para operar'} icon={Wallet} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
        <MetricCard title={isClient ? 'Saldo retenido' : 'Exposición en tránsito'} value={fmt(reservedBalance)} hint={isClient ? 'Importe reservado por operaciones pendientes' : 'Capital comprometido en envíos no liquidados'} icon={Clock3} tone="border-amber-500/20 bg-amber-500 shadow-amber-500/20" />
        <MetricCard title="Volumen 7 días" value={fmt(stats?.weeklyVolume ?? 0)} hint={`${stats?.todayTransfers ?? 0} operaciones registradas hoy`} icon={TrendingUp} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
        <MetricCard title={isClient ? 'Tasa de cierre' : 'Comisiones generadas'} value={isClient ? `${settlementRate}%` : fmt(stats?.totalCommission ?? 0)} hint={isClient ? 'Operaciones confirmadas frente al total' : `${fmt(stats?.todayCommission ?? 0)} generadas hoy`} icon={CreditCard} tone="border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20" />
      </section>

      {isSuperAdmin && marketingStats && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
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
                <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                  Solo superadmin
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Eventos</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.total_events}</p>
                </div>
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">CTA clicks</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.cta_clicks}</p>
                </div>
                <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-700 dark:text-fuchsia-300">Form submits</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.form_submits}</p>
                </div>
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Cambios audiencia</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.audience_switches}</p>
                </div>
                <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">7 días</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.events_7d}</p>
                </div>
                <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">30 días</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{marketingStats.totals.events_30d}</p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Audiencias</p>
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Top CTA</p>
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Temas usados</p>
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

          <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <BarChart3 className="h-5 w-5 text-primary" />
                Actividad reciente de captación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selección de audiencias</p>
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Targets más usados</p>
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
                        <Badge className="rounded-full bg-slate-900 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white dark:bg-white dark:text-slate-900">
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

      {!isClient && (
        <section className="grid grid-cols-1 gap-6">
          <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
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
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Hoy</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(commissionStats?.todayCommission ?? 0)}</p>
                    </div>
                    <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">Mes actual</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(commissionStats?.monthCommission ?? 0)}</p>
                    </div>
                    <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">Año actual</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(commissionStats?.yearCommission ?? 0)}</p>
                    </div>
                    <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:text-fuchsia-300">Acumulado</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(commissionStats?.totalCommission ?? 0)}</p>
                    </div>
                  </div>

                  {/* Tabla en escritorio, lista de tarjetas etiquetadas por debajo de lg.
                      `lg:contents` saca el <dl> del flujo en escritorio y deja que sus
                      cuatro hijos ocupen directamente las columnas 2-5 de la rejilla. */}
                  <div className="overflow-hidden rounded-3xl border border-border/10 bg-background/70">
                    <div className="hidden grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] gap-3 border-b border-border/10 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:grid">
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
                                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:hidden">{label}</dt>
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
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Hoy</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.todayCommission ?? 0)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Comisión generada hoy</p>
                  </div>
                  <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">Mes actual</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.monthlyCommission ?? 0)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Comisión acumulada del mes</p>
                  </div>
                  <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">Año actual</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.yearlyCommission ?? 0)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Comisión acumulada del año</p>
                  </div>
                  <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:text-fuchsia-300">Acumulado</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.totalCommission ?? 0)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Total histórico generado</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
        <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><Gauge className="h-5 w-5 text-primary" /> Tesorería y rendimiento</CardTitle>
                <p className="mt-2 text-sm font-medium text-muted-foreground">Liquidez, capital comprometido y pulso de volumen reciente.</p>
              </div>
              <div className="rounded-2xl border border-border/10 bg-background/70 px-4 py-3 text-right backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Promedio ticket</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmt(stats?.averageTicket ?? 0)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className={cn('grid gap-4', isClient ? 'md:grid-cols-3' : 'md:grid-cols-4')}>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Capital operativo</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.totalBalance ?? 0)}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{isClient ? 'Volumen 30 días' : 'Recarga proyectada 24h'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(isClient ? (stats?.monthlyVolume ?? 0) : (stats?.projectedTopups24h ?? 0))}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{isClient ? 'Confirmación' : 'Cobertura de float'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? `${settlementRate}%` : `${(stats?.liquidityCoverageDays ?? 0).toFixed(1)} días`}</p></div>
              {!isClient && <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Utilización del float</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{stats?.floatUtilization ?? 0}%</p></div>}
            </div>

            {!isClient && trend.length > 0 && (
              <div className="rounded-[1.75rem] border border-border/10 bg-background/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div><p className="text-sm font-bold text-foreground">Pulso de volumen</p><p className="text-xs font-medium text-muted-foreground">Últimos 7 días cerrados</p></div>
                  <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Volumen 30 días</p><p className="text-lg font-bold text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p></div>
                </div>
                <div className="-mx-1 grid grid-cols-7 gap-1.5 px-1 sm:gap-3">
                  {trend.map((item) => (
                    <div key={item.date} className="flex min-w-0 flex-col items-center gap-2 sm:gap-3">
                      <div className="flex h-24 w-full items-end rounded-2xl bg-muted/30 p-1.5 sm:h-40 sm:rounded-3xl sm:p-2">
                        <div className="w-full rounded-2xl bg-linear-to-t from-sky-500 via-cyan-400 to-emerald-400 shadow-lg shadow-sky-500/20" style={{ height: `${Math.max(Math.round((item.total_amount / maxTrend) * 100), item.total_amount > 0 ? 12 : 4)}%` }} title={fmt(item.total_amount)} />
                      </div>
                      <div className="min-w-0 text-center"><p className="truncate text-[9px] font-semibold text-muted-foreground sm:text-[10px] sm:uppercase sm:tracking-[0.16em]">{formatDateShort(item.date).slice(0, 5)}</p><p className="mt-1 text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">{item.transfer_count}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><ShieldCheck className="h-5 w-5 text-primary" /> Salud operativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
              <div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tasa de liquidación</p><p className="text-2xl font-bold text-foreground">{settlementRate}%</p></div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted/30"><div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-sky-500" style={{ width: `${Math.min(settlementRate, 100)}%` }} /></div>
            </div>
            <div className="space-y-4 rounded-3xl border border-border/10 bg-background/70 p-5">
              <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Pendientes</span><span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{pendingRate}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted/30"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(pendingRate, 100)}%` }} /></div></div>
              <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Canceladas</span><span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{cancelledRate}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted/30"><div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(cancelledRate, 100)}%` }} /></div></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isAdmin ? 'Gestores activos' : isGestor ? 'Clientes atendidos' : 'Confirmadas'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isAdmin ? stats?.activeAgents ?? 0 : isGestor ? stats?.totalClients ?? 0 : stats?.completedTransfers ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Saldo retenido' : 'Bajo umbral'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? fmt(reservedBalance) : stats?.agentsBelowThreshold ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Pendientes' : 'Disponibles para pago'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? stats?.pendingTransfers ?? 0 : stats?.pickupReadyTransfers ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Ticket medio' : 'Clientes únicos'}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{isClient ? fmt(stats?.averageTicket ?? 0) : stats?.totalClients ?? 0}</p></div>
            </div>
            {!isClient && (stats?.agentsBelowThreshold ?? 0) > 0 && (
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
                <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-bold uppercase tracking-[0.2em]">Atención de liquidez</p><p className="mt-1 text-sm font-medium">Hay {stats?.agentsBelowThreshold} gestor(es) por debajo del umbral operativo de 25.000 XAF.</p></div></div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground"><History className="h-5 w-5 text-primary" /> Operaciones recientes</CardTitle>
              <Button asChild variant="ghost" className="rounded-xl font-semibold text-muted-foreground hover:text-foreground">
              <Link href="/history">Ver historial completo<ArrowUpRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {recentTransfers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-6 py-10 text-center"><p className="text-sm font-semibold text-muted-foreground">Todavía no hay operaciones para mostrar.</p></div>
            ) : recentTransfers.map((transfer) => (
              <div key={transfer.id} className="flex flex-col gap-4 rounded-[1.75rem] border border-border/10 bg-background/70 p-4 hover:bg-background">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-xs font-bold text-white shadow-lg shadow-pink-500/20">{getInitials(transfer.receiver_name || transfer.sender_name)}</div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{transfer.receiver_name}</p>
                      <p className="text-xs font-medium text-muted-foreground">{transfer.sender_name} · {transfer.destination_city}</p>
                      {isAdmin && transfer.agent?.name && <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Gestor {transfer.agent.name}</p>}
                    </div>
                  </div>
                  <Badge className={cn('rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]', getStatusColor(transfer.status))}>{statusLabel(transfer.status)}</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Código</p><p className="text-sm font-bold text-foreground">{transfer.transfer_code}</p></div>
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fecha</p><p className="text-sm font-bold text-foreground">{formatDateShort(transfer.created_at)}</p></div>
                  <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Monto</p><p className="text-lg font-bold text-foreground">{fmt(transfer.amount)}</p></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
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
                  <div className="text-right"><p className="text-sm font-bold text-foreground">{fmt(agent.total_sent)}</p><p className="text-[10px] font-medium text-muted-foreground">{formatDateShort(agent.last_transfer)}</p></div>
                </div>
              )) : (
                <>
                  <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Volumen del mes</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p></div>
                  <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Meta de consistencia</p><div className="mt-3 flex items-center justify-between"><p className="text-2xl font-bold text-foreground">{settlementRate}%</p><Target className="h-5 w-5 text-emerald-500" /></div></div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass-premium min-w-0 overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
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

      <SupportModal open={supportModalOpen} onOpenChange={setSupportModalOpen} requestType={supportRequestType} />
    </div>
  );
}
