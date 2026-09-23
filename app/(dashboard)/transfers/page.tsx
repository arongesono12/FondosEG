'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { getDashboardStats, getRecentTransfers, getDailyTransferStats } from '@/services/dashboard';
import type { DashboardStats, DailyTransferStats, Transfer } from '@/types';
import { formatCurrency, convertCurrency, formatDateShort, formatDayOfMonth, getInitials, getStatusText, getStatusColor } from '@/lib/utils';
import { HttpError } from '@/services/http';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  TrendingUp,
  ArrowUpRight,
  Users,
  BarChart3,
  Landmark,
  MessageSquare,
  Wallet,
  QrCode,
  Send,
  HandCoins,
} from '@/components/ui/hugeicons';
import { SupportModal } from '@/components/layout/support-modal';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { WalletTransferModal } from '@/components/wallet-transfer-modal';
import { AgentPayoutModal } from '@/components/agent-payout-modal';
import { AgentTransferModal } from '@/components/agent-transfer-modal';
import { ClientWithdrawalModal } from '@/components/client-withdrawal-modal';
import { RevolutPayoutModal } from '@/components/revolut-payout-modal';
import { isAdminRole } from '@/lib/roles';

const weeklyVolumeConfig = {
  amount: { label: 'Volumen', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/**
 * Tarjeta de acción: la tarjeta entera es el botón. Antes era un `div` con
 * `onClick` —inalcanzable con teclado— y llevaba `p-6` encima del `p-6` de
 * cabecera y contenido, así que el texto quedaba a 48px del borde. El
 * «Iniciar →» de dentro pasa a ser un `span`: un botón dentro de otro no es
 * HTML válido y el objetivo ya es la tarjeta completa.
 */
function ActionCard({ onSelect, label, children }: { onSelect: () => void; label: string; children: React.ReactNode }) {
  return (
    <Card asChild className="transfer-action-card cursor-pointer">
      <button
        type="button"
        onClick={onSelect}
        // Sin nombre propio, el de la tarjeta sería todo su texto seguido
        // («Nueva Transferencia Enviar dinero A clientes… Iniciar»).
        aria-label={label}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {children}
      </button>
    </Card>
  );
}

const actionHintClasses = 'transfer-mobile-action mt-2 inline-flex items-center gap-2 whitespace-nowrap text-xs font-bold [&_svg]:size-4';

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
        const [statsData, transfersData, dailyData] = await Promise.all([
          isAdminRole(user?.role)
            ? Promise.resolve(null) 
            : getDashboardStats(),
          getRecentTransfers(20),
          isAdminRole(user?.role) ? getDailyTransferStats(30) : Promise.resolve([]),
        ]);
        
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
        const [statsData, transfersData, dailyData] = await Promise.all([
          isAdminRole(user?.role)
            ? Promise.resolve(null) 
            : getDashboardStats(),
          getRecentTransfers(20),
          isAdminRole(user?.role) ? getDailyTransferStats(30) : Promise.resolve([]),
        ]);
      
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
        <div className="grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const totalWeekly = dailyStats.slice(-7).reduce((sum, d) => sum + d.total_amount, 0);
  const totalMonthly = dailyStats.reduce((sum, d) => sum + d.total_amount, 0);
  const avgDaily = dailyStats.length > 0 ? totalMonthly / dailyStats.length : 0;

  return (
    <div className="transfers-mobile-page space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      {/* Variantes de contenedor (`@2xl:`), no de viewport: la página también
          se pinta dentro del panel de media pantalla, donde a 1024px de
          viewport sólo quedan ~470px de ancho. */}
      <div className="flex flex-col @2xl:flex-row justify-between items-start @2xl:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Envíos</h1>
          <p className="text-muted-foreground font-medium text-sm">Panel de control de transferencias</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 ${user?.role === 'gestor' ? '@xl:grid-cols-2 @6xl:grid-cols-3 @7xl:grid-cols-5' : user?.role === 'cliente' ? '@xl:grid-cols-2' : '@2xl:grid-cols-2 @4xl:grid-cols-4'} gap-4`}>
        {/* Card: Nueva Transferencia (Solo gestores) */}
        {user?.role === 'gestor' && (
          <ActionCard label="Nueva transferencia" onSelect={() => setAgentTransferOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Send className="h-4 w-4" /> Nueva Transferencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums sm:text-2xl">Enviar dinero</p>
              {/* `text-white` sobre la tarjeta clara no se veía en tema claro. */}
              <p className="text-xs text-muted-foreground mt-1">A clientes y beneficiarios</p>
              <span className={`${actionHintClasses} text-primary`}>
                Iniciar <ArrowUpRight className="h-3 w-3 ml-1" />
              </span>
            </CardContent>
          </ActionCard>
        )}

        {/* Card: Transferir a Cliente (Solo clientes) */}
        {user?.role === 'cliente' && (
          <ActionCard label="Transferir a cliente" onSelect={() => setWalletTransferOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Transferir a Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">Sin comisión</p>
              <p className="text-xs text-green-500 mt-1">Envía dinero a otro cliente</p>
              <span className={`${actionHintClasses} text-green-600`}>
                Iniciar <ArrowUpRight className="h-3 w-3 ml-1" />
              </span>
            </CardContent>
          </ActionCard>
        )}

        {/* Sin tarjeta de "Confirmar Recepción": desde 20260826 el envío entre
            clientes se entrega en el acto y no hay nada que confirmar. El
            código sobrevive sólo en el retiro de efectivo, que tiene su propia
            tarjeta justo debajo. */}

        {/* Card: Retirar Efectivo (Solo clientes) */}
        {user?.role === 'cliente' && (
          <ActionCard label="Retirar efectivo" onSelect={() => setWithdrawalOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <HandCoins className="h-4 w-4" /> Retirar Efectivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">Tu código</p>
              <p className="text-xs text-amber-500 mt-1">Genera tu código y cóbralo en un gestor</p>
              <span className={`${actionHintClasses} text-amber-600`}>
                Generar <ArrowUpRight className="h-3 w-3 ml-1" />
              </span>
            </CardContent>
          </ActionCard>
        )}

        {/* Card: Pagar Transferencia (Solo gestores) */}
        {user?.role === 'gestor' && (
          <ActionCard label="Pagar transferencia" onSelect={() => setAgentPayoutOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <QrCode className="h-4 w-4" /> Pagar transferencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Código de retiro</p>
              <p className="text-xs text-emerald-500 mt-1">Valida la transferencia y registra el pago</p>
              <span className={`${actionHintClasses} text-emerald-600`}>
                Ver disponibles <ArrowUpRight className="h-3 w-3 ml-1" />
              </span>
            </CardContent>
          </ActionCard>
        )}
        {/* Card: Payout Revolut (gestores y administración) */}
        {user?.role !== 'cliente' && (
          <ActionCard label="Payout Revolut" onSelect={() => setRevolutPayoutOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-sky-700 dark:text-sky-300 flex items-center gap-2">
                <Landmark className="h-4 w-4" /> Payout Revolut
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">Link externo</p>
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">Alternativa cuando no hay gestor</p>
              <span className={`${actionHintClasses} text-sky-700 dark:text-sky-300`}>
                Generar <ArrowUpRight className="h-3 w-3 ml-1" />
              </span>
            </CardContent>
          </ActionCard>
        )}
        {/* Card 1: Flujo del Día */}
        {user?.role !== 'cliente' && (
        <ActionCard label="Flujo del día" onSelect={() => setShowDailyModal(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Flujo del Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(stats?.todayTransfers || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">transacciones hoy</p>
            <span className={`${actionHintClasses} text-primary`}>
              Ver todo <ArrowUpRight className="h-3 w-3 ml-1" />
            </span>
          </CardContent>
        </ActionCard>

        )}

        {/* Card 2: Envíos de Gestores */}
        {user?.role !== 'cliente' && (
        <ActionCard label="Envíos de gestores" onSelect={() => setShowAgentsModal(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Envíos de Gestores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">{recentTransfers.length}</p>
            <p className="text-xs text-muted-foreground mt-1">transferencias totales</p>
            <span className={`${actionHintClasses} text-primary`}>
              Ver todo <ArrowUpRight className="h-3 w-3 ml-1" />
            </span>
          </CardContent>
        </ActionCard>
        )}

        {/* Card 3: Volumen Semanal */}
        {user?.role !== 'cliente' && (
        <ActionCard label="Volumen semanal" onSelect={() => setShowWeeklyModal(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Volumen Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(totalWeekly)}</p>
            <p className="text-xs text-muted-foreground mt-1">últimos 7 días</p>
            <span className={`${actionHintClasses} text-primary`}>
              Ver todo <ArrowUpRight className="h-3 w-3 ml-1" />
            </span>
          </CardContent>
        </ActionCard>
        )}

        {/* Card 4: Soporte */}
        <ActionCard label="Soporte" onSelect={() => setSupportOpen(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Soporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">24/7</p>
            <p className="text-xs text-muted-foreground mt-1">asistencia disponible</p>
            <span className={`${actionHintClasses} text-primary`}>
              Contactar <ArrowUpRight className="h-3 w-3 ml-1" />
            </span>
          </CardContent>
        </ActionCard>
      </div>

      {/* Recent Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">Últimas Transferencias</CardTitle>
        </CardHeader>
        {/* Con el primitivo `Table` la tabla tiene un envoltorio que se
            desplaza y roles ARIA explícitos; la `<table>` suelta de antes no
            tenía desbordamiento propio y en un teléfono arrastraba la página
            entera hacia un lado. En contenedores estrechos se apila en
            tarjetas (app/styles/tables.css). */}
        <CardContent className="activity-records-scroll">
          <Table className="activity-records-table" wrapperClassName="is-stacked">
            <TableHeader>
              <TableRow className="border-b border-border/10 hover:bg-transparent">
                <TableHead className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Código</TableHead>
                <TableHead className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Remitente</TableHead>
                <TableHead className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Destinatario</TableHead>
                <TableHead className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Monto</TableHead>
                <TableHead className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Estado</TableHead>
                <TableHead className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransfers.slice(0, 10).map((transfer) => (
                <TableRow key={transfer.id} className="activity-record-row border-b border-border/5 hover:bg-muted/30">
                  <TableCell data-label="Código" className="py-3 px-4 text-sm font-bold">{transfer.transfer_code || 'N/A'}</TableCell>
                  <TableCell data-label="Remitente" className="py-3 px-4 text-sm">{transfer.sender_name || 'N/A'}</TableCell>
                  <TableCell data-label="Destinatario" className="py-3 px-4 text-sm">{transfer.receiver_name || 'N/A'}</TableCell>
                  <TableCell data-label="Monto" className="py-3 px-4 text-sm font-bold tabular-nums">{formatBalance(transfer.amount)}</TableCell>
                  <TableCell data-label="Estado" className="py-3 px-4">
                    <Badge className={getStatusColor(transfer.status)}>
                      {getStatusText(transfer.status)}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Fecha" className="py-3 px-4 text-xs text-muted-foreground">
                    {formatDateShort(transfer.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal: Flujo del Día */}
      <Dialog open={showDailyModal} onOpenChange={setShowDailyModal}>
        <DialogContent size="xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Flujo del Día
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {/* Tres columnas cuando el cuerpo del modal (no la ventana) mide 32rem. */}
            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3 @lg:gap-4">
              <div className="min-w-0 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Transacciones Hoy</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{stats?.todayTransfers || 0}</p>
              </div>
              <div className="min-w-0 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Monto Enviado</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{formatBalance(stats?.totalSent || 0)}</p>
              </div>
              <div className="min-w-0 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
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
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5" /> Envíos de Gestores
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
                  <p className="text-sm font-bold">{formatBalance(transfer.amount)}</p>
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
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Volumen Semanal
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3 @lg:gap-4">
              <div className="min-w-0 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Esta Semana</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{formatBalance(totalWeekly)}</p>
              </div>
              <div className="min-w-0 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Este Mes</p>
                <p className="text-xl font-bold tabular-nums wrap-break-word @lg:text-2xl">{formatBalance(totalMonthly)}</p>
              </div>
              <div className="min-w-0 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
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
