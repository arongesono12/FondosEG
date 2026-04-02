'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { getDashboardStats, getRecentTransfers, getAgentsCommissionStats } from '@/services/dashboard';
import type { AgentsCommissionStats, DashboardStats, Transfer } from '@/types';
import { formatCurrency, cn, getInitials, convertCurrency } from '@/lib/utils';
import { HttpError } from '@/services/http';
import { 
  ArrowUpRight,
  TrendingUp,
  Plus,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SupportModal } from '@/components/layout/support-modal';
import {
  FlujoDiaModal,
  GestoresModal,
  VolumenSemanalModal,
  SoporteModal,
  ComisionesModal,
} from '@/components/layout/dashboard-detail-modals';

export default function DashboardPage() {
  const { user, preferredCurrency } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportRequestType, setSupportRequestType] = useState<'balance_topup' | 'report_error' | 'general'>('general');
  const [commissionStats, setCommissionStats] = useState<AgentsCommissionStats | null>(null);

  // Detail modal states
  const [flujoDiaOpen, setFlujoDiaOpen] = useState(false);
  const [gestoresOpen, setGestoresOpen] = useState(false);
  const [volumenOpen, setVolumenOpen] = useState(false);
  const [comisionesOpen, setComisionesOpen] = useState(false);
  const [soporteOpen, setSoporteOpen] = useState(false);

  const displayCurrency = preferredCurrency || 'XAF';
  const dashboardCardClass =
    'glass-premium bg-card/30 dark:bg-card/20 relative border-border/10 overflow-hidden shadow-2xl';
  const dashboardSubCardClass =
    'p-5 rounded-3xl bg-muted/20 dark:bg-slate-900/40 border border-border/5 flex flex-col gap-3 transition-all duration-300 hover:bg-muted/30 dark:hover:bg-slate-900/50';
  const dashboardSubCardSmClass =
    'p-4 rounded-[1.25rem] bg-muted/20 dark:bg-slate-900/40 border border-border/5 transition-colors hover:bg-muted/30 dark:hover:bg-slate-900/50';

  const formatBalance = (amount: number) => {
    const converted = convertCurrency(amount, 'XAF', displayCurrency);
    return formatCurrency(converted, displayCurrency);
  };

  const totalTransfersCount = (stats?.completedTransfers || 0) + (stats?.pendingTransfers || 0) + (stats?.cancelledTransfers || 0);
  const completedPercent = totalTransfersCount > 0 ? Math.round(((stats?.completedTransfers || 0) / totalTransfersCount) * 100) : 0;
  const pendingPercent = totalTransfersCount > 0 ? Math.round(((stats?.pendingTransfers || 0) / totalTransfersCount) * 100) : 0;
  const cancelledPercent = totalTransfersCount > 0 ? Math.round(((stats?.cancelledTransfers || 0) / totalTransfersCount) * 100) : 0;

  const balanceProgress = Math.min(((stats?.totalBalance || 0) / 1000000) * 100, 100);
  const sentProgress = stats?.totalBalance ? Math.min(((stats?.totalSent || 0) / stats.totalBalance) * 100, 100) : 0;
  const operationsProgress = Math.min(((stats?.todayTransfers || 0) / 20) * 100, 100);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, transfersData, commissionData] = await Promise.all([
          getDashboardStats(),
          getRecentTransfers(5),
          user?.role === 'admin' ? getAgentsCommissionStats() : Promise.resolve(null)
        ]);
        setStats(statsData);
        setRecentTransfers(transfersData);
        setCommissionStats(commissionData);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) {
          console.error('Error loading dashboard data:', error);
        }
      } finally {
        setLoading(false);
      }
    }
    if (user) loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground font-semibold">Cargando tablero...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tighter">Panel</h1>
          <div className="flex items-center gap-2 text-muted-foreground font-bold text-xs md:text-sm">
            <span className="hidden sm:inline">
              <span className="text-brand-gradient">FondosEG</span> x {user?.name || 'Equipo Directo'}
            </span>
            <span className="sm:hidden">{user?.name || 'Usuario'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 hidden md:inline" />
            <span className="items-center gap-1 cursor-pointer hover:text-foreground transition-colors uppercase tracking-widest text-[10px] hidden md:flex">
              ID S-DIRECT-08PX <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-card/50 backdrop-blur-sm rounded-full border border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Comisiones</span>
              <span className="text-sm font-black text-green-500">{formatBalance((stats?.totalSent || 0) * 0.02)}</span>
            </div>
            <div className="w-px h-4 bg-border/50" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Promedio</span>
              <span className="text-sm font-black text-foreground">{formatBalance((stats?.totalSent || 0) / Math.max(stats?.todayTransfers || 1, 1))}</span>
            </div>
            <div className="w-px h-4 bg-border/50" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Tasa</span>
              <span className="text-sm font-black text-pink-500">98.5%</span>
            </div>
          </div>
        </div>

        {user?.role === 'admin' ? (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 h-14 px-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-black text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Envíos Deshabilitados</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" /> Los administradores no realizan envíos directamente
            </span>
          </div>
        ) : user?.role === 'gestor' ? (
          <Link href="/transfers">
            <Button className="h-12 md:h-14 px-6 md:px-8 rounded-xl md:rounded-2xl bg-brand-gradient text-white font-black text-base md:text-lg shadow-lg md:shadow-xl shadow-pink-500/20 hover:scale-[1.02] active:scale-95 transition-all gap-2 md:gap-3">
              <Plus className="h-4 md:h-5 w-4 md:w-5" /> Nuevo Envío
            </Button>
          </Link>
        ) : null}
      </div>

      {/* 2 & 3: Today Stats & Radial Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* FLUJO DEL DÍA */}
        <div
          className={cn(
            'lg:col-span-2 space-y-4 p-5 md:p-8 rounded-[10px] transition-all duration-500 text-card-foreground',
            dashboardCardClass
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold">Flujo del Día</h2>
            <Button
              variant="ghost"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setFlujoDiaOpen(true)}
            >
              Ver todo
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={dashboardSubCardClass}>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-500 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-none text-[10px] font-bold uppercase">
                  Capital Total
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xl md:text-2xl font-bold">{formatBalance(stats?.totalBalance || 0)}</p>
                <p className="text-xs font-medium text-muted-foreground">Saldo disponible</p>
              </div>
              <div className="mt-auto h-1.5 w-full bg-muted/40 dark:bg-muted/20 rounded-full overflow-hidden">
                <div className="h-full bg-linear-to-r from-blue-400 to-blue-500 rounded-full" style={{ width: `${balanceProgress}%` }} />
              </div>
            </div>
            <div className={dashboardSubCardClass}>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-purple-500 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-none text-[10px] font-bold uppercase">
                  Enviado Hoy
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xl md:text-2xl font-bold">{formatBalance(stats?.totalSent || 0)}</p>
                <p className="text-xs font-medium text-muted-foreground">Volumen procesado</p>
              </div>
              <div className="mt-auto h-1.5 w-full bg-muted/40 dark:bg-muted/20 rounded-full overflow-hidden">
                <div className="h-full bg-linear-to-r from-purple-400 to-purple-500 rounded-full" style={{ width: `${sentProgress}%` }} />
              </div>
            </div>
            <div className={dashboardSubCardClass}>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-orange-500 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shadow-none text-[10px] font-bold uppercase">
                  Operaciones
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xl md:text-2xl font-bold">{stats?.todayTransfers || 0}</p>
                <p className="text-xs font-medium text-muted-foreground">Total transacciones</p>
              </div>
              <div className="mt-auto h-1.5 w-full bg-muted/40 dark:bg-muted/20 rounded-full overflow-hidden">
                <div className="h-full bg-linear-to-r from-orange-400 to-orange-500 rounded-full" style={{ width: `${operationsProgress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Radial Distribution */}
        <div
          className={cn(
            'p-5 md:p-8 rounded-[10px] transition-all duration-500 flex flex-col gap-4 md:gap-6 text-card-foreground',
            dashboardCardClass
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold">Distribución</h2>
            <p className="text-xs font-medium text-muted-foreground">{totalTransfersCount} total</p>
          </div>
          <div className="flex-1 flex items-center justify-center relative">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="transparent" className="stroke-muted/30" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#8b5cf6" strokeWidth="10" strokeDasharray="251" strokeDashoffset={251 * (1 - completedPercent / 100)} strokeLinecap="round" />
                <circle cx="50" cy="50" r="30" fill="transparent" className="stroke-muted/30" strokeWidth="8" />
                <circle cx="50" cy="50" r="30" fill="transparent" stroke="#f97316" strokeWidth="10" strokeDasharray="188" strokeDashoffset={188 * (1 - pendingPercent / 100)} strokeLinecap="round" />
                <circle cx="50" cy="50" r="20" fill="transparent" className="stroke-muted/30" strokeWidth="8" />
                <circle cx="50" cy="50" r="20" fill="transparent" stroke="#3b82f6" strokeWidth="10" strokeDasharray="125" strokeDashoffset={125 * (1 - cancelledPercent / 100)} strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-xs font-medium text-muted-foreground">Completadas</span>
              </div>
              <span className="text-sm font-bold">{completedPercent}%</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-xs font-medium text-muted-foreground">En Tránsito</span>
              </div>
              <span className="text-sm font-bold">{pendingPercent}%</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">Pendientes</span>
              </div>
              <span className="text-sm font-bold">{cancelledPercent}%</span>
            </div>
            </div>
          </div>
        </div>

        {/* COMISIONES - Only Admin and Gestor */}
        {user?.role !== 'cliente' && (
        <div
          className={cn(
            'p-5 md:p-8 rounded-[10px] transition-all duration-500 text-card-foreground',
            dashboardCardClass
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold">Comisiones</h2>
            <Button
              variant="ghost"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setComisionesOpen(true)}
            >
              Ver todo
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {user?.role === 'admin' ? (
              <>
                <div className={dashboardSubCardSmClass}>
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shadow-none text-[10px] font-bold uppercase mb-2">
                    Comisión Total
                  </Badge>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatBalance(commissionStats?.totalCommission || 0)}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Todos los gestores</p>
                </div>
                <div className={dashboardSubCardSmClass}>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-none text-[10px] font-bold uppercase mb-2">
                    Comisión Hoy
                  </Badge>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatBalance(commissionStats?.todayCommission || 0)}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Ganado hoy</p>
                </div>
                <div className={dashboardSubCardSmClass}>
                  <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-none text-[10px] font-bold uppercase mb-2">
                    Gestores
                  </Badge>
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{commissionStats?.agents?.length || 0}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Activos</p>
                </div>
              </>
            ) : (
              <>
                <div className={dashboardSubCardSmClass}>
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shadow-none text-[10px] font-bold uppercase mb-2">
                    Mi Comisión Total
                  </Badge>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatBalance(stats?.totalCommission || 0)}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Ganancias por envíos</p>
                </div>
                <div className={dashboardSubCardSmClass}>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-none text-[10px] font-bold uppercase mb-2">
                    Comisión Hoy
                  </Badge>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatBalance(stats?.todayCommission || 0)}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Ganado hoy</p>
                </div>
                <div className={dashboardSubCardSmClass}>
                  <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-none text-[10px] font-bold uppercase mb-2">
                    Promedio
                  </Badge>
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{formatBalance(stats?.commissionPerTransfer || 0)}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Por transacción</p>
                </div>
              </>
            )}
          </div>
        </div>
        )}

      {stats?.balancesByCurrency && Object.keys(stats.balancesByCurrency).length > 0 && (
        <div
          className={cn(
            'p-5 md:p-8 rounded-[10px] transition-all duration-500 text-card-foreground',
            dashboardCardClass
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold">Saldo por Moneda</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(() => {
              const currencyToShow = preferredCurrency || 'XAF';
              const amount = stats.balancesByCurrency![currencyToShow] || stats.balancesByCurrency!['XAF'] || 0;
              return (
                <div key={currencyToShow} className={cn(dashboardSubCardSmClass, 'flex flex-col items-start')}>
                  <span className="text-xs font-bold text-muted-foreground uppercase">{currencyToShow}</span>
                  <span className="text-lg font-bold mt-1">{formatCurrency(amount, currencyToShow)}</span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4, 5 & 6: Ranking, Tracker & Chat - Only for Admin and Gestor */}
      {user?.role !== 'cliente' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">

        {/* ENVÍOS DE GESTORES */}
        <div
          className={cn(
            'space-y-4 p-5 md:p-8 rounded-[10px] transition-all duration-500 text-card-foreground',
            dashboardCardClass
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold">
              {user?.role === 'admin' ? 'Envíos de Gestores' : user?.role === 'gestor' ? 'Actividad Top' : 'Mi Actividad'}
            </h2>
            <Button
              variant="ghost"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setGestoresOpen(true)}
            >
              Ver todo
            </Button>
          </div>

          {user?.role === 'admin' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/20 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wide">
                Únete a <span className="text-brand-gradient">FondosEG</span> y comienza a gestionar envíos directamente
              </span>
            </div>
          )}

          <div className="space-y-5">
            {recentTransfers.slice(0, 3).map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-xs",
                    idx === 0 ? "bg-linear-to-br from-orange-400 to-orange-500" : idx === 1 ? "bg-linear-to-br from-blue-400 to-blue-500" : "bg-linear-to-br from-purple-400 to-purple-500"
                  )}>
                    {getInitials(item.receiver_name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-none">{item.receiver_name}</p>
                    {user?.role === 'admin' && (item as Transfer & { agent?: { name: string } }).agent?.name && (
                      <p className="text-[10px] font-medium text-primary uppercase tracking-tighter">
                        Gestor: {(item as Transfer & { agent?: { name: string } }).agent?.name}
                      </p>
                    )}
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter mt-0.5">{item.destination_city}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatBalance(item.amount)}</p>
                  <p className="text-[10px] font-bold text-rose-500 uppercase">Monto</p>
                </div>
              </div>
            ))}
            {recentTransfers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay transferencias recientes</p>
            )}
          </div>
        </div>

        {/* VOLUMEN SEMANAL */}
        <div
          className={cn(
            'space-y-4 p-5 md:p-8 rounded-[10px] transition-all duration-500 text-card-foreground',
            dashboardCardClass
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold">Volumen Semanal</h2>
            <Button
              variant="ghost"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setVolumenOpen(true)}
            >
              Ver todo
            </Button>
          </div>
          <div className="h-32 md:h-40 flex items-end justify-between gap-2 px-2">
            {[40, 70, 50, 90, 60, 80].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full relative group">
                  <div className="absolute inset-x-0 bottom-0 bg-muted rounded-full h-40 opacity-20" />
                  <div
                    className={cn(
                      "w-full rounded-full transition-all duration-700",
                      i % 2 === 0 ? "bg-linear-to-b from-rose-400 to-rose-500" : "bg-linear-to-b from-blue-400 to-blue-500"
                    )}
                    style={{ height: `${h}%` }}
                    title={`${h}%`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Envíos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Cobros</span>
            </div>
          </div>
        </div>

        {/* SOPORTE */}
        <div
          className={cn(
            'space-y-4 p-5 md:p-8 rounded-[10px] transition-all duration-500 text-card-foreground',
            dashboardCardClass
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold">Soporte</h2>
            <Button
              variant="ghost"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setSoporteOpen(true)}
            >
              Ver todo
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col items-end gap-1">
              <div className="bg-muted/80 dark:bg-muted/50 p-3 rounded-2xl rounded-tr-none text-xs font-medium text-muted-foreground max-w-[80%]">
                Hola {user?.name.split(' ')[0]}, ¿necesitas ayuda con alguna transferencia hoy?
              </div>
              <span className="text-[9px] font-medium text-muted-foreground/60 uppercase">Admin - 10:25</span>
            </div>

            <div className="flex items-center gap-3 bg-linear-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 p-4 rounded-2xl border border-primary/10">
              <div className="h-10 w-10 shrink-0 bg-brand-gradient flex items-center justify-center rounded-xl text-white shadow-lg shadow-pink-500/20">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex gap-0.5 items-center">
                  {[2, 5, 3, 8, 4, 3, 6, 2, 4, 7].map((h, i) => (
                    <div key={i} className="flex-1 bg-primary/30 rounded-full" style={{ height: `${h * 2}px` }} />
                  ))}
                </div>
                <div className="flex justify-between items-center text-[9px] font-medium text-primary/60 uppercase tracking-widest">
                  <span>Grabación ID-88</span>
                  <span>0:12</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="link"
            className="w-full text-rose-500 font-bold text-sm p-0 underline mt-4"
            onClick={() => { 
              if (user?.role === 'gestor') {
                setSupportRequestType('balance_topup');
                setSupportModalOpen(true);
              } else {
                setSoporteOpen(true);
              }
            }}
          >
            Hablar con Administración
          </Button>
        </div>
      </div>
      )}

      {/* ─── MODALES / DRAWERS ──────────────────────────────────────── */}
      <SoporteModal
        open={soporteOpen}
        onClose={() => setSoporteOpen(false)}
        onContactAdmin={() => { setSoporteOpen(false); setSupportRequestType('general'); setSupportModalOpen(true); }}
        userName={user?.name}
        userRole={user?.role}
        onRequestTopup={() => { setSoporteOpen(false); setSupportRequestType('balance_topup'); setSupportModalOpen(true); }}
        onReportError={() => { setSoporteOpen(false); setSupportRequestType('report_error'); setSupportModalOpen(true); }}
        onCheckOrder={() => { setSoporteOpen(false); setGestoresOpen(true); }}
      />

      <SupportModal
        open={supportModalOpen}
        onOpenChange={setSupportModalOpen}
        requestType={supportRequestType}
      />

      <ComisionesModal
        open={comisionesOpen}
        onClose={() => setComisionesOpen(false)}
        userRole={user?.role}
        stats={stats}
        commissionStats={commissionStats}
        preferredCurrency={displayCurrency}
      />

      <FlujoDiaModal
        open={flujoDiaOpen}
        onClose={() => setFlujoDiaOpen(false)}
        stats={stats}
        preferredCurrency={displayCurrency}
      />

      <GestoresModal
        open={gestoresOpen}
        onClose={() => setGestoresOpen(false)}
        userRole={user?.role}
        preferredCurrency={displayCurrency}
      />

      <VolumenSemanalModal
        open={volumenOpen}
        onClose={() => setVolumenOpen(false)}
        preferredCurrency={displayCurrency}
      />
    </div>
  );
}
