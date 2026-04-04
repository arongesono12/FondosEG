'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getAgentTransferStats, getDashboardStats, getDailyTransferStats, getRecentTransfers } from '@/services/dashboard';
import type { AgentTransferStats, DashboardStats, DailyTransferStats, Transfer } from '@/types';
import { cn, convertCurrency, formatCurrency, formatDateShort, getInitials, getStatusColor } from '@/lib/utils';
import { HttpError } from '@/services/http';
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
  Gauge,
  History,
  Landmark,
  LifeBuoy,
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
    <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
            <p className="text-2xl font-black text-foreground">{value}</p>
            <p className="text-xs font-semibold text-muted-foreground">{hint}</p>
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
  const isAdmin = user?.role === 'admin';
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
        <Skeleton className="h-40 w-full rounded-[2rem]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="rounded-[2rem] border border-border/10 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(248,250,252,0.72))] p-6 shadow-2xl shadow-slate-200/40 backdrop-blur-xl dark:bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.82))] dark:shadow-black/20 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <Badge className="w-fit rounded-full border border-white/30 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              {isAdmin ? 'Dirección' : isGestor ? 'Gestor' : 'Cliente'} x FondosEG
            </Badge>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">Dashboard financiero y operativo</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground md:text-base">
                {isAdmin ? 'Liquidez, exposición, red y rentabilidad en una sola lectura.' : isGestor ? 'Control diario de float, volumen, cierres y ritmo operativo.' : 'Seguimiento claro de saldo, operaciones y confirmaciones de tu billetera.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Volumen hoy</p>
                <p className="mt-1 text-lg font-black text-foreground">{fmt(stats?.todayVolume ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">Cobertura</p>
                <p className="mt-1 text-lg font-black text-foreground">{(stats?.liquidityCoverageDays ?? 0).toFixed(1)} días</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Utilización</p>
                <p className="mt-1 text-lg font-black text-foreground">{stats?.floatUtilization ?? 0}%</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={primaryAction.href}>
              <Button className="h-14 w-full rounded-2xl bg-brand-gradient px-6 text-base font-black text-white shadow-xl shadow-pink-500/20 hover:scale-[1.01]">
                <PrimaryIcon className="mr-2 h-5 w-5" />
                {primaryAction.label}
              </Button>
            </Link>
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-border/20 bg-white/60 px-6 text-base font-black backdrop-blur-md dark:bg-white/5"
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={isClient ? 'Saldo disponible' : 'Float disponible'} value={fmt(availableBalance)} hint={isClient ? 'Fondos listos para usar' : 'Liquidez inmediata para operar'} icon={Wallet} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
        <MetricCard title={isClient ? 'Saldo retenido' : 'Exposición en tránsito'} value={fmt(reservedBalance)} hint={isClient ? 'Importe reservado por operaciones pendientes' : 'Capital comprometido en envíos no liquidados'} icon={Clock3} tone="border-amber-500/20 bg-amber-500 shadow-amber-500/20" />
        <MetricCard title="Volumen 7 días" value={fmt(stats?.weeklyVolume ?? 0)} hint={`${stats?.todayTransfers ?? 0} operaciones registradas hoy`} icon={TrendingUp} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
        <MetricCard title={isClient ? 'Tasa de cierre' : 'Ingreso por comisiones'} value={isClient ? `${settlementRate}%` : fmt(stats?.totalCommission ?? 0)} hint={isClient ? 'Operaciones confirmadas frente al total' : `${fmt(stats?.todayCommission ?? 0)} generadas hoy`} icon={CreditCard} tone="border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground"><Gauge className="h-5 w-5 text-primary" /> Tesorería y rendimiento</CardTitle>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">Liquidez, capital comprometido y pulso de volumen reciente.</p>
              </div>
              <div className="rounded-2xl border border-border/10 bg-background/70 px-4 py-3 text-right backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Promedio ticket</p>
                <p className="mt-1 text-xl font-black text-foreground">{fmt(stats?.averageTicket ?? 0)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className={cn('grid gap-4', isClient ? 'md:grid-cols-3' : 'md:grid-cols-4')}>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Capital operativo</p><p className="mt-2 text-2xl font-black text-foreground">{fmt(stats?.totalBalance ?? 0)}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{isClient ? 'Volumen 30 días' : 'Recarga proyectada 24h'}</p><p className="mt-2 text-2xl font-black text-foreground">{fmt(isClient ? (stats?.monthlyVolume ?? 0) : (stats?.projectedTopups24h ?? 0))}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{isClient ? 'Confirmación' : 'Cobertura de float'}</p><p className="mt-2 text-2xl font-black text-foreground">{isClient ? `${settlementRate}%` : `${(stats?.liquidityCoverageDays ?? 0).toFixed(1)} días`}</p></div>
              {!isClient && <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Utilización del float</p><p className="mt-2 text-2xl font-black text-foreground">{stats?.floatUtilization ?? 0}%</p></div>}
            </div>

            {!isClient && trend.length > 0 && (
              <div className="rounded-[1.75rem] border border-border/10 bg-background/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div><p className="text-sm font-black text-foreground">Pulso de volumen</p><p className="text-xs font-semibold text-muted-foreground">Últimos 7 días cerrados</p></div>
                  <div className="text-right"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Volumen 30 días</p><p className="text-lg font-black text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p></div>
                </div>
                <div className="grid grid-cols-7 gap-3">
                  {trend.map((item) => (
                    <div key={item.date} className="flex flex-col items-center gap-3">
                      <div className="flex h-40 w-full items-end rounded-3xl bg-muted/30 p-2">
                        <div className="w-full rounded-2xl bg-linear-to-t from-sky-500 via-cyan-400 to-emerald-400 shadow-lg shadow-sky-500/20" style={{ height: `${Math.max(Math.round((item.total_amount / maxTrend) * 100), item.total_amount > 0 ? 12 : 4)}%` }} title={fmt(item.total_amount)} />
                      </div>
                      <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{formatDateShort(item.date).slice(0, 5)}</p><p className="mt-1 text-xs font-bold text-foreground">{item.transfer_count}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground"><ShieldCheck className="h-5 w-5 text-primary" /> Salud operativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-3xl border border-border/10 bg-background/70 p-5">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Tasa de liquidación</p><p className="text-2xl font-black text-foreground">{settlementRate}%</p></div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted/30"><div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-sky-500" style={{ width: `${Math.min(settlementRate, 100)}%` }} /></div>
            </div>
            <div className="space-y-4 rounded-3xl border border-border/10 bg-background/70 p-5">
              <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-black text-foreground">Pendientes</span><span className="text-xs font-black text-amber-600 dark:text-amber-400">{pendingRate}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted/30"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(pendingRate, 100)}%` }} /></div></div>
              <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-black text-foreground">Canceladas</span><span className="text-xs font-black text-rose-600 dark:text-rose-400">{cancelledRate}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted/30"><div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(cancelledRate, 100)}%` }} /></div></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{isAdmin ? 'Gestores activos' : isGestor ? 'Clientes atendidos' : 'Confirmadas'}</p><p className="mt-2 text-2xl font-black text-foreground">{isAdmin ? stats?.activeAgents ?? 0 : isGestor ? stats?.totalClients ?? 0 : stats?.completedTransfers ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Saldo retenido' : 'Bajo umbral'}</p><p className="mt-2 text-2xl font-black text-foreground">{isClient ? fmt(reservedBalance) : stats?.agentsBelowThreshold ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Pendientes' : 'Disponibles para pago'}</p><p className="mt-2 text-2xl font-black text-foreground">{isClient ? stats?.pendingTransfers ?? 0 : stats?.pickupReadyTransfers ?? 0}</p></div>
              <div className="rounded-3xl border border-border/10 bg-background/70 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{isClient ? 'Ticket medio' : 'Clientes únicos'}</p><p className="mt-2 text-2xl font-black text-foreground">{isClient ? fmt(stats?.averageTicket ?? 0) : stats?.totalClients ?? 0}</p></div>
            </div>
            {!isClient && (stats?.agentsBelowThreshold ?? 0) > 0 && (
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
                <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-black uppercase tracking-[0.2em]">Atención de liquidez</p><p className="mt-1 text-sm font-semibold">Hay {stats?.agentsBelowThreshold} gestor(es) por debajo del umbral operativo de 25.000 XAF.</p></div></div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground"><History className="h-5 w-5 text-primary" /> Operaciones recientes</CardTitle>
              <Link href="/history"><Button variant="ghost" className="rounded-xl font-bold text-muted-foreground hover:text-foreground">Ver historial completo<ArrowUpRight className="ml-2 h-4 w-4" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {recentTransfers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-6 py-10 text-center"><p className="text-sm font-bold text-muted-foreground">Todavía no hay operaciones para mostrar.</p></div>
            ) : recentTransfers.map((transfer) => (
              <div key={transfer.id} className="flex flex-col gap-4 rounded-[1.75rem] border border-border/10 bg-background/70 p-4 hover:bg-background">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-xs font-black text-white shadow-lg shadow-pink-500/20">{getInitials(transfer.receiver_name || transfer.sender_name)}</div>
                    <div>
                      <p className="text-sm font-black text-foreground">{transfer.receiver_name}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{transfer.sender_name} · {transfer.destination_city}</p>
                      {isAdmin && transfer.agent?.name && <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">Gestor {transfer.agent.name}</p>}
                    </div>
                  </div>
                  <Badge className={cn('rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]', getStatusColor(transfer.status))}>{statusLabel(transfer.status)}</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Código</p><p className="text-sm font-black text-foreground">{transfer.transfer_code}</p></div>
                  <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Fecha</p><p className="text-sm font-black text-foreground">{formatDateShort(transfer.created_at)}</p></div>
                  <div className="text-right"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Monto</p><p className="text-lg font-black text-foreground">{fmt(transfer.amount)}</p></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">{isAdmin ? <Users className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}{isAdmin ? ' Top gestores por volumen' : ' Resumen ejecutivo'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {isAdmin ? agentStats.slice(0, 5).map((agent, index) => (
                <div key={agent.agent_id} className="flex items-center justify-between rounded-3xl border border-border/10 bg-background/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-black text-white dark:bg-white dark:text-slate-900">#{index + 1}</div>
                    <div><p className="text-sm font-black text-foreground">{agent.agent_name}</p><p className="text-xs font-semibold text-muted-foreground">{agent.transfer_count} operaciones</p></div>
                  </div>
                  <div className="text-right"><p className="text-sm font-black text-foreground">{fmt(agent.total_sent)}</p><p className="text-[10px] font-semibold text-muted-foreground">{formatDateShort(agent.last_transfer)}</p></div>
                </div>
              )) : (
                <>
                  <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Volumen del mes</p><p className="mt-2 text-2xl font-black text-foreground">{fmt(stats?.monthlyVolume ?? 0)}</p></div>
                  <div className="rounded-3xl border border-border/10 bg-background/70 p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Meta de consistencia</p><div className="mt-3 flex items-center justify-between"><p className="text-2xl font-black text-foreground">{settlementRate}%</p><Target className="h-5 w-5 text-emerald-500" /></div></div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
            <CardHeader className="border-b border-border/5 pb-5">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground"><BarChart3 className="h-5 w-5 text-primary" /> Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              <Link href={isAdmin ? '/stats' : '/history'}><div className="rounded-3xl border border-border/10 bg-background/70 p-4 hover:bg-background"><p className="text-sm font-black text-foreground">{isAdmin ? 'Analítica avanzada' : 'Historial operativo'}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{isAdmin ? 'Explora tendencia, red y concentración por gestor.' : 'Revisa operaciones, estados y fechas clave.'}</p></div></Link>
              <Link href="/balance"><div className="rounded-3xl border border-border/10 bg-background/70 p-4 hover:bg-background"><p className="text-sm font-black text-foreground">{isAdmin ? 'Tesorería de red' : 'Mi liquidez'}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{isAdmin ? 'Recarga saldos y controla disponibilidad por gestor.' : 'Consulta movimientos y saldo operativo en tiempo real.'}</p></div></Link>
              <button type="button" className="rounded-3xl border border-border/10 bg-background/70 p-4 text-left hover:bg-background" onClick={() => { setSupportRequestType(isGestor ? 'balance_topup' : 'general'); setSupportModalOpen(true); }}>
                <p className="text-sm font-black text-foreground">Escalar incidencia</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Contacta con administración para recargas, errores o seguimiento.</p>
              </button>
            </CardContent>
          </Card>
        </div>
      </section>

      <SupportModal open={supportModalOpen} onOpenChange={setSupportModalOpen} requestType={supportRequestType} />
    </div>
  );
}
