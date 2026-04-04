'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getAgentTransferStats, getAgentsCommissionStats, getDashboardReconciliation, getDashboardStats, getDailyTransferStats, getRecentTransfers } from '@/services/dashboard';
import type { AgentTransferStats, AgentsCommissionStats, DashboardStats, DailyTransferStats, ReconciliationSummary, Transfer } from '@/types';
import { cn, convertCurrency, formatCurrency, formatDateShort, getStatusColor } from '@/lib/utils';
import { HttpError } from '@/services/http';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  BarChart3,
  CreditCard,
  PieChart as PieChartIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

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
    <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border text-white shadow-lg', tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-black text-foreground">{value}</p>
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
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';
  const isGestor = user?.role === 'gestor';
  const currency = preferredCurrency || 'XAF';

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, dailyData, recentData, agentsData, commissionData, reconciliationData] = await Promise.all([
          getDashboardStats(),
          getDailyTransferStats(30),
          getRecentTransfers(8),
          isAdmin ? getAgentTransferStats() : Promise.resolve([]),
          isAdmin ? getAgentsCommissionStats() : Promise.resolve(null),
          isAdmin ? getDashboardReconciliation(4) : Promise.resolve(null),
        ]);

        setStats(statsData);
        setDailyStats(dailyData);
        setRecentTransfers(recentData);
        setAgentStats(agentsData);
        setCommissionStats(commissionData);
        setReconciliation(reconciliationData);
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
  }, [user, isAdmin]);

  const fmt = (amount: number) => formatCurrency(convertCurrency(amount, 'XAF', currency), currency);

  const chartData = dailyStats.map((item) => ({
    date: formatDateShort(item.date).slice(0, 5),
    amount: Math.round(convertCurrency(item.total_amount, 'XAF', currency)),
    count: item.transfer_count,
    agents: item.agent_count,
  }));

  const statusData = [
    { name: 'Completadas', value: stats?.completedTransfers ?? 0 },
    { name: 'Pendientes', value: stats?.pendingTransfers ?? 0 },
    { name: 'Canceladas', value: stats?.cancelledTransfers ?? 0 },
  ].filter((item) => item.value > 0);

  const concentrationData = (isAdmin ? agentStats : []).slice(0, 5).map((agent) => ({
    name: agent.agent_name,
    value: Math.round(convertCurrency(agent.total_sent, 'XAF', currency)),
    ops: agent.transfer_count,
  }));
  const commissionLeaders = (commissionStats?.agents || []).slice(0, 5);

  const totalOps = (stats?.completedTransfers ?? 0) + (stats?.pendingTransfers ?? 0) + (stats?.cancelledTransfers ?? 0);
  const settlementRate = stats?.settlementRate ?? 0;
  const reconciliationPeriods = reconciliation?.periods ?? [];

  const formatPeriodLabel = (period: string) => {
    const [year, month] = period.split('-').map(Number);
    if (!year || !month) return period;
    return new Date(year, month - 1, 1).toLocaleString('es-ES', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-[2rem]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!isAdmin && !isGestor) {
    return (
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-border/10 bg-card/50 p-8 shadow-xl shadow-black/5 backdrop-blur-xl">
          <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            Analítica disponible para operación
          </Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">Estadísticas operativas</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Esta vista avanzada está orientada a dirección y gestores. Desde tu perfil puedes seguir saldo, movimientos y confirmaciones de forma clara.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/dashboard">
              <Button className="rounded-2xl bg-brand-gradient px-6 font-black text-white">Volver al panel</Button>
            </Link>
            <Link href="/history">
              <Button variant="outline" className="rounded-2xl px-6 font-black">Ver historial</Button>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(248,250,252,0.72))] p-6 shadow-2xl shadow-slate-200/40 backdrop-blur-xl dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.82))] dark:shadow-black/20 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="rounded-full border border-white/30 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">Volumen 30 días</p>
              <p className="mt-1 text-xl font-black text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Tasa de cierre</p>
              <p className="mt-1 text-xl font-black text-foreground">{settlementRate}%</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatChip label="Volumen total" value={fmt(stats?.monthlyVolume ?? 0)} hint="Acumulado de 30 días" icon={TrendingUp} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
        <StatChip label="Operaciones" value={String(totalOps)} hint={`${stats?.todayTransfers ?? 0} registradas hoy`} icon={BarChart3} tone="border-indigo-500/20 bg-indigo-500 shadow-indigo-500/20" />
        <StatChip label="Ticket promedio" value={fmt(stats?.averageTicket ?? 0)} hint="Promedio por envío completado" icon={CreditCard} tone="border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20" />
        <StatChip label={isAdmin ? 'Gestores activos' : 'Clientes únicos'} value={String(isAdmin ? stats?.activeAgents ?? 0 : stats?.totalClients ?? 0)} hint={isAdmin ? 'Participando en la red' : 'Atendidos en el período'} icon={Users} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <BarChart3 className="h-5 w-5 text-primary" />
              Flujo de volumen y actividad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148,163,184,0.18)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 800 }} axisLine={false} tickLine={false} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 800 }} axisLine={false} tickLine={false} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderRadius: '18px',
                      border: '1px solid var(--border)',
                      boxShadow: '0 20px 45px rgba(15,23,42,0.12)',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="amount" name="Volumen" stroke="#0ea5e9" strokeWidth={3.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="count" name="Operaciones" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Semana actual</p>
                <p className="mt-2 text-2xl font-black text-foreground">{fmt(stats?.weeklyVolume ?? 0)}</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Hoy</p>
                <p className="mt-2 text-2xl font-black text-foreground">{fmt(stats?.todayVolume ?? 0)}</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Comisión media</p>
                <p className="mt-2 text-2xl font-black text-foreground">{fmt(stats?.commissionPerTransfer ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <PieChartIcon className="h-5 w-5 text-primary" />
              {isAdmin ? 'Distribución de red' : 'Distribución operativa'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={isAdmin ? concentrationData : statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={104}
                    paddingAngle={4}
                  >
                    {(isAdmin ? concentrationData : statusData).map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderRadius: '18px',
                      border: '1px solid var(--border)',
                      boxShadow: '0 20px 45px rgba(15,23,42,0.12)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {(isAdmin ? concentrationData : statusData).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl border border-border/10 bg-background/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <div>
                      <p className="text-sm font-black text-foreground">{item.name}</p>
                      {'ops' in item && <p className="text-[10px] font-semibold text-muted-foreground">{item.ops} operaciones</p>}
                    </div>
                  </div>
                  <p className="text-sm font-black text-foreground">{isAdmin ? fmt(item.value) : item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Calidad operativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Liquidación</p>
                <p className="text-2xl font-black text-foreground">{settlementRate}%</p>
              </div>
              <div className="mt-4 h-3 rounded-full bg-muted/30">
                <div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-sky-500" style={{ width: `${Math.min(settlementRate, 100)}%` }} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Pendientes</p>
                <p className="mt-2 text-2xl font-black text-foreground">{stats?.pendingTransfers ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Canceladas</p>
                <p className="mt-2 text-2xl font-black text-foreground">{stats?.cancelledTransfers ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Float utilizado</p>
                <p className="mt-2 text-2xl font-black text-foreground">{stats?.floatUtilization ?? 0}%</p>
              </div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Cobertura</p>
                <p className="mt-2 text-2xl font-black text-foreground">{(stats?.liquidityCoverageDays ?? 0).toFixed(1)} días</p>
              </div>
            </div>

            <Link href="/dashboard">
              <Button variant="outline" className="w-full rounded-2xl font-black">
                Volver al panel
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              {isAdmin ? 'Comisiones por gestor' : 'Últimas operaciones observadas'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {isAdmin ? (
              commissionLeaders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-6 py-10 text-center">
                  <p className="text-sm font-bold text-muted-foreground">No hay datos de comisión todavía.</p>
                </div>
              ) : (
                commissionLeaders.map((agent) => (
                  <div key={agent.agent_id} className="rounded-[1.5rem] border border-border/10 bg-background/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-foreground">{agent.agent_name}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {agent.transfer_count} operaciones · hoy {fmt(agent.today_commission)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Costo est. {fmt(agent.estimated_cost)} · margen {agent.net_margin}%
                        </p>
                      </div>
                      <Badge className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">
                        Neto estimado
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-lg font-black text-foreground">{fmt(agent.net_profit)}</p>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Comisión {fmt(agent.total_commission)}</p>
                    </div>
                  </div>
                ))
              )
            ) : (
              recentTransfers.map((transfer) => (
                <div key={transfer.id} className="rounded-[1.5rem] border border-border/10 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-foreground">{transfer.transfer_code}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {transfer.sender_name} · {transfer.receiver_name}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                        {transfer.destination_city} · {formatDateShort(transfer.created_at)}
                      </p>
                    </div>
                    <Badge className={cn('rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]', getStatusColor(transfer.status))}>
                      {transfer.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-lg font-black text-foreground">{fmt(transfer.amount)}</p>
                    <Link href="/history">
                      <Button variant="ghost" className="rounded-xl font-bold text-muted-foreground hover:text-foreground">
                        Ver historial
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {isAdmin && (
        <section className="grid gap-6">
          <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
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
                  <div key={period.period} className="rounded-[1.5rem] border border-border/10 bg-background/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-foreground">{formatPeriodLabel(period.period)}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Topups {fmt(period.topups)} · Salidas {fmt(period.transfersOutflow)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Ajustes {fmt(period.resets)} · Reembolsos {fmt(period.refunds)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-foreground">{fmt(period.netFlow)}</p>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{period.transactionCount} movimientos</p>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {reconciliation && (
                <div className="rounded-2xl border border-border/10 bg-background/70 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Neto del período</p>
                    <p className="text-base font-black text-foreground">{fmt(reconciliation.totalNetFlow)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
