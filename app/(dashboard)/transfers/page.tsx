'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { getDashboardStats, getRecentTransfers, getDailyTransferStats } from '@/services/dashboard';
import type { DashboardStats, DailyTransferStats, Transfer, UserRole } from '@/types';
import { formatCurrency, convertCurrency, formatDayOfMonth, getInitials, getStatusText, getStatusColor } from '@/lib/utils';
import { HttpError } from '@/services/http';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowUpRight, ExternalLink, HandCoins, LifeBuoy, QrCode, Receipt, Send, Users } from '@/components/ui/hugeicons';
import { MetricArea, MetricBars, MetricCard, MetricDesk, MetricRate, MetricTiles, ModuleMetrics, ModuleMetricsSkeleton } from '@/components/dashboard/module-metric-card';
import { RecentTransfersPanel } from '@/components/dashboard/transfer-record-panel';
import { dailySeries, lastDaysSeries } from '@/lib/dashboard-series';
import { isTransferCompleted } from '@/lib/financial';
import { SupportModal } from '@/components/layout/support-modal';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { WalletTransferModal } from '@/components/wallet-transfer-modal';
import { AgentPayoutModal } from '@/components/agent-payout-modal';
import { AgentTransferModal } from '@/components/agent-transfer-modal';
import { ClientWithdrawalModal } from '@/components/client-withdrawal-modal';
import { RevolutPayoutModal } from '@/components/revolut-payout-modal';

const weeklyVolumeConfig = {
  amount: { label: 'Volumen', color: 'var(--chart-1)' },
} satisfies ChartConfig;

// El servidor sólo sirve la serie diaria a gestores y administración.
// Si fallan los totales, las tarjetas muestran «—» y la tabla se sigue cargando.
function fetchTransfersPageData(role?: UserRole) {
  return Promise.all([
    getDashboardStats().catch((error: unknown) => {
      if (!(error instanceof HttpError && error.status === 401)) {
        console.error('Error loading dashboard stats:', error);
      }
      return null;
    }),
    getRecentTransfers(20),
    role && role !== 'cliente' ? getDailyTransferStats(30) : Promise.resolve([]),
  ]);
}

export default function TransfersPage() {
  const { user, preferredCurrency } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyTransferStats[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showAgentsModal, setShowAgentsModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [walletTransferOpen, setWalletTransferOpen] = useState(false);
  const [agentTransferOpen, setAgentTransferOpen] = useState(false);
  const [agentPayoutOpen, setAgentPayoutOpen] = useState(false);
  const [revolutPayoutOpen, setRevolutPayoutOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  
  const displayCurrency = preferredCurrency || 'XAF';

  const formatBalance = (amount: number) => {
    const converted = convertCurrency(amount, 'XAF', displayCurrency);
    return formatCurrency(converted, displayCurrency);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, transfersData, dailyData] = await fetchTransfersPageData(user?.role);

        setStats(statsData);
        setRecentTransfers(transfersData || []);
        setDailyStats(dailyData || []);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) {
          console.error('Error loading data:', error);
        }
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
      loadData();
    }
  }, [user]);

  const refreshData = async () => {
    try {
      const [statsData, transfersData, dailyData] = await fetchTransfersPageData(user?.role);

      setStats(statsData);
      setRecentTransfers(transfersData || []);
      setDailyStats(dailyData || []);
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 401)) {
        console.error('Error refreshing data:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <ModuleMetricsSkeleton />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const totalWeekly = dailyStats.slice(-7).reduce((sum, d) => sum + d.total_amount, 0);
  const totalMonthly = dailyStats.reduce((sum, d) => sum + d.total_amount, 0);
  const avgDaily = dailyStats.length > 0 ? totalMonthly / dailyStats.length : 0;
  // Sin stats la carga falló: las cifras son desconocidas («—»), no cero.
  const money = (value: number | undefined) => (stats ? formatBalance(value ?? 0) : '—');
  const count = (value: number | undefined) => (stats ? String(value ?? 0) : '—');
  const available = stats?.availableBalance ?? stats?.totalBalance;
  const supportAction = { label: 'Contactar con soporte, asistencia 24/7', icon: <LifeBuoy />, onSelect: () => setSupportOpen(true) };

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* Variantes de contenedor (`@2xl:`) según el ancho de la página. */}
      <div className="flex flex-col @2xl:flex-row justify-between items-start @2xl:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Envíos</h1>
          <p className="text-muted-foreground font-medium text-sm">Panel de control de transferencias</p>
        </div>
      </div>

      {user?.role === 'cliente' ? (
        <ModuleMetrics label="Resumen de envíos">
          <MetricCard
            layout="desk"
            title="Saldo retenido"
            value={money(stats?.reservedBalance ?? stats?.pendingExposure)}
            caption={<><span className="overview-tone-warning">{count(stats?.pendingTransfers)} pendientes</span> de liquidación</>}
          >
            <MetricDesk />
          </MetricCard>
          <MetricCard
            title="Volumen de la semana"
            value={money(stats?.weeklyVolume)}
            caption={<><span className="overview-tone-primary">{count(stats?.todayTransfers)} operaciones</span> registradas hoy</>}
          >
            {/* La cifra sólo suma completadas: la barra también, en la moneda de la pantalla. */}
            <MetricBars
              data={lastDaysSeries(
                recentTransfers.filter((transfer) => isTransferCompleted(transfer.status)),
                (transfer) => transfer.created_at,
                (transfer) => convertCurrency(transfer.amount, transfer.currency, displayCurrency),
              )}
              seriesLabel="Volumen"
              format={(value) => formatCurrency(value, displayCurrency)}
            />
          </MetricCard>
          <MetricCard
            title="Tasa de cierre"
            value={<>{count(stats?.settlementRate)}<small> %</small></>}
            caption={<><span className="overview-tone-success">{count(stats?.completedTransfers)} completadas</span> en total</>}
          >
            <MetricRate value={stats?.settlementRate ?? 0} label={`${count(stats?.settlementRate)}% de operaciones liquidadas`} />
          </MetricCard>
          <MetricCard
            layout="tiles"
            title="Disponible para operar"
            value={money(available)}
            caption="Tu billetera FondosEG"
            action={supportAction}
          >
            <MetricTiles tiles={[
              { icon: <HandCoins />, title: 'Retirar', detail: 'Tu código', label: 'Retirar efectivo', onSelect: () => setWithdrawalOpen(true) },
              { icon: <Send />, title: 'Transferir', detail: 'Sin comisión', label: 'Transferir a cliente', onSelect: () => setWalletTransferOpen(true), featured: true },
              { icon: <Receipt />, title: 'Actividad', detail: 'Ver historial', href: '/history' },
            ]} />
          </MetricCard>
        </ModuleMetrics>
      ) : (
        <ModuleMetrics label="Resumen de envíos">
          <MetricCard
            layout="desk"
            title="Flujo del día"
            value={count(stats?.todayTransfers)}
            caption={<><span className="overview-tone-warning">{money(stats?.todayVolume)}</span> enviados hoy</>}
            action={{ label: 'Ver flujo del día', icon: <ArrowUpRight />, onSelect: () => setShowDailyModal(true) }}
          >
            <MetricDesk />
          </MetricCard>
          <MetricCard
            title="Volumen semanal"
            value={stats ? formatBalance(totalWeekly) : '—'}
            caption={<><span className="overview-tone-primary">{dailyStats.slice(-7).reduce((sum, day) => sum + day.transfer_count, 0)} operaciones</span> últimos 7 días</>}
            action={{ label: 'Ver volumen semanal', icon: <ArrowUpRight />, onSelect: () => setShowWeeklyModal(true) }}
          >
            <MetricBars data={dailySeries(dailyStats, (day) => convertCurrency(day.total_amount, 'XAF', displayCurrency))} seriesLabel="Volumen" format={(value) => formatCurrency(value, displayCurrency)} />
          </MetricCard>
          <MetricCard
            title="Envíos de gestores"
            value={String(recentTransfers.length)}
            caption="últimas operaciones cargadas"
            action={{ label: 'Ver envíos de gestores', icon: <ArrowUpRight />, onSelect: () => setShowAgentsModal(true) }}
          >
            <MetricArea data={dailySeries(dailyStats, (day) => day.transfer_count)} seriesLabel="Operaciones" legend="Operaciones por día · 7 días" />
          </MetricCard>
          <MetricCard
            layout="tiles"
            title="Disponible para operar"
            value={money(available)}
            caption="Liquidez inmediata"
            action={supportAction}
          >
            <MetricTiles tiles={user?.role === 'gestor' ? [
              { icon: <QrCode />, title: 'Pagar', detail: 'Con código', label: 'Pagar transferencia', onSelect: () => setAgentPayoutOpen(true) },
              { icon: <Send />, title: 'Enviar', detail: 'Nueva', label: 'Nueva transferencia', onSelect: () => setAgentTransferOpen(true), featured: true },
              { icon: <ExternalLink />, title: 'Revolut', detail: 'Payout', label: 'Payout Revolut', onSelect: () => setRevolutPayoutOpen(true) },
            ] : [
              { icon: <Users />, title: 'Gestores', detail: 'Ver red', href: '/agents' },
              { icon: <ExternalLink />, title: 'Revolut', detail: 'Payout', label: 'Payout Revolut', onSelect: () => setRevolutPayoutOpen(true), featured: true },
              { icon: <Receipt />, title: 'Actividad', detail: 'Ver historial', href: '/history' },
            ]} />
          </MetricCard>
        </ModuleMetrics>
      )}

      {/* Últimas operaciones */}
      <RecentTransfersPanel
        title="Últimas transferencias"
        transfers={recentTransfers.slice(0, 10)}
        format={(amount, currency) => formatCurrency(convertCurrency(amount, currency, displayCurrency), displayCurrency)}
        emptyMessage="Todavía no hay operaciones."
        newTransfer={user?.role === 'cliente'
          ? { onSelect: () => setWalletTransferOpen(true) }
          : user?.role === 'gestor'
            ? { onSelect: () => setAgentTransferOpen(true) }
            : undefined}
      />

      {/* Modal: Flujo del Día */}
      <Dialog open={showDailyModal} onOpenChange={setShowDailyModal}>
        <DialogContent size="xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Flujo del Día
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {/* Tres columnas cuando el cuerpo del modal (no la ventana) mide 32rem. */}
            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3 @lg:gap-4">
              <div className="min-w-0 p-4 dashboard-inset rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Transacciones Hoy</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{stats?.todayTransfers || 0}</p>
              </div>
              <div className="min-w-0 p-4 dashboard-inset rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Monto Enviado</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{formatBalance(stats?.totalSent || 0)}</p>
              </div>
              <div className="min-w-0 p-4 dashboard-inset rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Comisión Hoy</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{formatBalance(stats?.todayCommission || 0)}</p>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Modal: Envíos de Gestores */}
      <Dialog open={showAgentsModal} onOpenChange={setShowAgentsModal}>
        <DialogContent size="xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Envíos de Gestores
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {recentTransfers.map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-brand-gradient flex items-center justify-center text-white font-bold text-xs">
                    {getInitials(transfer.receiver_name || 'U')}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{transfer.receiver_name || 'N/A'}</p>
                    <p className="truncate text-xs text-muted-foreground">{transfer.destination_city || 'N/A'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold">{formatCurrency(convertCurrency(transfer.amount, transfer.currency, displayCurrency), displayCurrency)}</p>
                  <Badge className={getStatusColor(transfer.status)}>
                    {getStatusText(transfer.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Modal: Volumen Semanal */}
      <Dialog open={showWeeklyModal} onOpenChange={setShowWeeklyModal}>
        <DialogContent size="xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Volumen Semanal
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3 @lg:gap-4">
              <div className="min-w-0 p-4 dashboard-inset rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Esta Semana</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{formatBalance(totalWeekly)}</p>
              </div>
              <div className="min-w-0 p-4 dashboard-inset rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Este Mes</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{formatBalance(totalMonthly)}</p>
              </div>
              <div className="min-w-0 p-4 dashboard-inset rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Promedio Diario</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{formatBalance(avgDaily)}</p>
              </div>
            </div>

            {/* Gráfico a todo el ancho del cuerpo, sin ancho mínimo: el
                `min-w-[380px]` con su envoltorio desplazable metía un scroll
                horizontal dentro del modal. Las barras son horizontales, así
                que se leen bien a cualquier ancho. Alto fijo (h-72): el cuerpo
                se desplaza en vez de aplastar el gráfico. */}
            <ChartContainer config={weeklyVolumeConfig} className="aspect-auto h-72 w-full">
              <BarChart
                accessibilityLayer
                data={dailyStats.slice(-14).map((day) => ({
                  name: formatDayOfMonth(day.date),
                  amount: Math.round(convertCurrency(day.total_amount, 'XAF', displayCurrency)),
                }))}
                layout="vertical"
                margin={{ left: 0, right: 8 }}
              >
                <XAxis type="number" dataKey="amount" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  width={34}
                  tick={{ fontSize: 10, fill: 'currentColor', fontWeight: 700 }}
                  className="text-muted-foreground"
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="dot" />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
              </BarChart>
            </ChartContainer>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Support Modal */}
      <SupportModal open={supportOpen} onOpenChange={setSupportOpen} />

      {/* Wallet Transfer Modal (para clientes) */}
      <WalletTransferModal 
        open={walletTransferOpen} 
        onOpenChange={setWalletTransferOpen}
        onSuccess={() => {
          refreshData();
        }}
      />

      {/* Agent Payout Modal (para gestores) */}
      <AgentPayoutModal
        open={agentPayoutOpen}
        onOpenChange={setAgentPayoutOpen}
        onSuccess={() => {
          refreshData();
        }}
      />

      {/* Agent Transfer Modal (para gestores) */}
      <AgentTransferModal 
        open={agentTransferOpen} 
        onOpenChange={setAgentTransferOpen}
        onSuccess={refreshData}
      />

      <RevolutPayoutModal
        open={revolutPayoutOpen}
        onOpenChange={setRevolutPayoutOpen}
        onSuccess={refreshData}
      />

      {/* Client Withdrawal Modal (para clientes) */}
      <ClientWithdrawalModal
        open={withdrawalOpen}
        onOpenChange={setWithdrawalOpen}
        onSuccess={refreshData}
      />
    </div>
  );
}
