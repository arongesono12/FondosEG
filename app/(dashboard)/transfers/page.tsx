'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { getDashboardStats, getRecentTransfers, getDailyTransferStats } from '@/services/dashboard';
import type { DashboardStats, DailyTransferStats, Transfer } from '@/types';
import { formatCurrency, convertCurrency, formatDateShort, formatDayOfMonth, getInitials, getStatusText, getStatusColor } from '@/lib/utils';
import { HttpError } from '@/services/http';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog, 
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
} from 'lucide-react';
import { SupportModal } from '@/components/layout/support-modal';
import { WalletTransferModal } from '@/components/wallet-transfer-modal';
import { AgentPayoutModal } from '@/components/agent-payout-modal';
import { AgentTransferModal } from '@/components/agent-transfer-modal';
import { ClientWithdrawalModal } from '@/components/client-withdrawal-modal';
import { RevolutPayoutModal } from '@/components/revolut-payout-modal';
import { isAdminRole } from '@/lib/roles';

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Envíos</h1>
          <p className="text-muted-foreground font-medium text-sm">Panel de control de transferencias</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 ${user?.role === 'gestor' ? 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5' : user?.role === 'cliente' ? 'sm:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'} gap-4`}>
        {/* Card: Nueva Transferencia (Solo gestores) */}
        {user?.role === 'gestor' && (
          <Card className="transfer-action-card bg-brand-gradient border-0 rounded-3xl p-6 cursor-pointer hover:shadow-xl transition-all text-white" onClick={() => setAgentTransferOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Send className="h-4 w-4" /> Nueva Transferencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums sm:text-2xl">Enviar dinero</p>
              <p className="text-xs text-white/70 mt-1">A clientes y beneficiarios</p>
              <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-white mt-2 p-0 h-auto">
                Iniciar <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Card: Transferir a Cliente (Solo clientes) */}
        {user?.role === 'cliente' && (
          <Card className="transfer-action-card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => setWalletTransferOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Transferir a Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">Sin comisión</p>
              <p className="text-xs text-green-500 mt-1">Envía dinero a otro cliente</p>
              <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-green-600 mt-2 p-0 h-auto">
                Iniciar <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sin tarjeta de "Confirmar Recepción": desde 20260826 el envío entre
            clientes se entrega en el acto y no hay nada que confirmar. El
            código sobrevive sólo en el retiro de efectivo, que tiene su propia
            tarjeta justo debajo. */}

        {/* Card: Retirar Efectivo (Solo clientes) */}
        {user?.role === 'cliente' && (
          <Card className="transfer-action-card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => setWithdrawalOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <HandCoins className="h-4 w-4" /> Retirar Efectivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">Tu código</p>
              <p className="text-xs text-amber-500 mt-1">Genera tu código y cóbralo en un gestor</p>
              <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-amber-600 mt-2 p-0 h-auto">
                Generar <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Card: Pagar Transferencia (Solo gestores) */}
        {user?.role === 'gestor' && (
          <Card className="transfer-action-card bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => setAgentPayoutOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <QrCode className="h-4 w-4" /> Pagar transferencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Código de retiro</p>
              <p className="text-xs text-emerald-500 mt-1">Valida la transferencia y registra el pago</p>
              <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-emerald-600 mt-2 p-0 h-auto">
                Ver disponibles <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Card: Payout Revolut (gestores y administración) */}
        {user?.role !== 'cliente' && (
          <Card className="transfer-action-card bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => setRevolutPayoutOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-sky-700 dark:text-sky-300 flex items-center gap-2">
                <Landmark className="h-4 w-4" /> Payout Revolut
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">Link externo</p>
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">Alternativa cuando no hay gestor</p>
              <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-sky-700 dark:text-sky-300 mt-2 p-0 h-auto">
                Generar <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Card 1: Flujo del Día */}
        {user?.role !== 'cliente' && (
        <Card className="transfer-action-card bg-card border-border/50 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => setShowDailyModal(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Flujo del Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(stats?.todayTransfers || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">transacciones hoy</p>
            <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-primary mt-2 p-0 h-auto">
              Ver todo <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        )}

        {/* Card 2: Envíos de Gestores */}
        {user?.role !== 'cliente' && (
        <Card className="transfer-action-card bg-card border-border/50 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => setShowAgentsModal(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Envíos de Gestores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">{recentTransfers.length}</p>
            <p className="text-xs text-muted-foreground mt-1">transferencias totales</p>
            <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-primary mt-2 p-0 h-auto">
              Ver todo <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Card 3: Volumen Semanal */}
        {user?.role !== 'cliente' && (
        <Card className="transfer-action-card bg-card border-border/50 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => setShowWeeklyModal(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Volumen Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(totalWeekly)}</p>
            <p className="text-xs text-muted-foreground mt-1">últimos 7 días</p>
            <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-primary mt-2 p-0 h-auto">
              Ver todo <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Card 4: Soporte */}
        <Card className="transfer-action-card bg-card border-border/50 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => setSupportOpen(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Soporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums sm:text-2xl">24/7</p>
            <p className="text-xs text-muted-foreground mt-1">asistencia disponible</p>
            <Button variant="ghost" className="transfer-mobile-action text-xs font-bold text-primary mt-2 p-0 h-auto">
              Contactar <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transfers Table */}
      <Card className="bg-card border-border/50 rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Últimas Transferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="activity-records-scroll table-scroll is-stacked">
            <table className="activity-records-table w-full">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Código</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Remitente</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Destinatario</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Monto</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Estado</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentTransfers.slice(0, 10).map((transfer) => (
                  <tr key={transfer.id} className="activity-record-row border-b border-border/5 hover:bg-muted/30">
                    <td data-label="Código" className="py-3 px-4 text-sm font-bold">{transfer.transfer_code || 'N/A'}</td>
                    <td data-label="Remitente" className="py-3 px-4 text-sm">{transfer.sender_name || 'N/A'}</td>
                    <td data-label="Destinatario" className="py-3 px-4 text-sm">{transfer.receiver_name || 'N/A'}</td>
                    <td data-label="Monto" className="py-3 px-4 text-sm font-bold tabular-nums">{formatBalance(transfer.amount)}</td>
                    <td data-label="Estado" className="py-3 px-4">
                      <Badge className={getStatusColor(transfer.status)}>
                        {getStatusText(transfer.status)}
                      </Badge>
                    </td>
                    <td data-label="Fecha" className="py-3 px-4 text-xs text-muted-foreground">
                      {formatDateShort(transfer.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Flujo del Día */}
      <Dialog open={showDailyModal} onOpenChange={setShowDailyModal}>
        <DialogContent className="max-w-2xl lg:max-h-[80dvh] lg:overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Flujo del Día
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Transacciones Hoy</p>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{stats?.todayTransfers || 0}</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Monto Enviado</p>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(stats?.totalSent || 0)}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Comisión Hoy</p>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(stats?.todayCommission || 0)}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Envíos de Gestores */}
      <Dialog open={showAgentsModal} onOpenChange={setShowAgentsModal}>
        <DialogContent className="max-w-2xl lg:max-h-[80dvh] lg:overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5" /> Envíos de Gestores
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {recentTransfers.map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white font-bold text-xs">
                    {getInitials(transfer.receiver_name || 'U')}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{transfer.receiver_name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{transfer.destination_city || 'N/A'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatBalance(transfer.amount)}</p>
                  <Badge className={getStatusColor(transfer.status)}>
                    {getStatusText(transfer.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Volumen Semanal */}
      <Dialog open={showWeeklyModal} onOpenChange={setShowWeeklyModal}>
        <DialogContent className="max-w-2xl lg:max-h-[80dvh] lg:overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Volumen Semanal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Esta Semana</p>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(totalWeekly)}</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Este Mes</p>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(totalMonthly)}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase">Promedio Diario</p>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{formatBalance(avgDaily)}</p>
              </div>
            </div>
            
            {/* Bar Chart */}
            {/* 14 barras en 292px darían 13px por barra con las etiquetas
                solapadas: se le da ancho mínimo y scroll horizontal propio. */}
            <div className="-mx-2 overflow-x-auto overscroll-x-contain px-2">
              <div className="flex h-48 min-w-[520px] items-end justify-between gap-2">
                {dailyStats.slice(-14).map((day, idx) => (
                  <div key={idx} className="flex min-w-[28px] flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full bg-brand-gradient rounded-t-md"
                      style={{ height: `${Math.max((day.total_amount / (avgDaily * 2 || 1)) * 100, 5)}%` }}
                    />
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {formatDayOfMonth(day.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
