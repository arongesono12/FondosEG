'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getAgentBalance, getAgentTransactions, getAgents, topUpAgentBalance } from '@/services/agent';
import { getTransfers } from '@/services/transfer';
import { fetchJSON } from '@/services/http';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import type { AgentBalance, AgentWithBalance, BalanceTransaction, ClientBalance, Transfer } from '@/types';
import { isAdminRole } from '@/lib/roles';
import {
  AlertCircle,
  ArrowDownUp,
  Banknote,
  CheckCircle,
  Clock3,
  History,
  Landmark,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';

type BalanceResponse = { balances: ClientBalance[] };

function SummaryCard({
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
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">{hint}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-white shadow-lg ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function transactionTypeLabel(type: BalanceTransaction['type']) {
  switch (type) {
    case 'topup':
      return 'Recarga';
    case 'transfer':
      return 'Transferencia';
    case 'refund':
      return 'Reembolso';
    case 'commission':
      return 'Comisión';
    default:
      return type;
  }
}

export default function BalancePage() {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(true);

  const [agents, setAgents] = useState<AgentWithBalance[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentWithBalance | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const [agentBalance, setAgentBalance] = useState<AgentBalance | null>(null);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);

  const [clientBalances, setClientBalances] = useState<ClientBalance[]>([]);
  const [clientTransfers, setClientTransfers] = useState<Transfer[]>([]);

  const isAdmin = isAdminRole(user?.role);
  const isGestor = user?.role === 'gestor';
  const isClient = user?.role === 'cliente';

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (isAdmin) {
        const agentsData = await getAgents();
        setAgents(agentsData);
        return;
      }

      if (isGestor) {
        const [balanceData, transactionData] = await Promise.all([
          getAgentBalance(user.id),
          getAgentTransactions(user.id, 50),
        ]);
        setAgentBalance(balanceData);
        setTransactions(transactionData);
        return;
      }

      const [balancesData, transfersData] = await Promise.all([
        fetchJSON<BalanceResponse>(`/api/balance?userId=${encodeURIComponent(user.id)}`),
        getTransfers(50),
      ]);
      setClientBalances(balancesData.balances || []);
      setClientTransfers(transfersData);
    } catch (error) {
      console.error('Error loading balance data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isGestor]); // Dependencies for loadData

  useEffect(() => {
    loadData();
  }, [user, isAdmin, isGestor, isClient, loadData]);

  const totalNetworkFloat = agents.reduce((sum, agent) => sum + Number(agent.balance || 0), 0);
  const totalNetworkCash = agents.reduce((sum, agent) => sum + Number(agent.cash_balance || 0), 0);
  const lowFloatAgents = agents.filter((agent) => Number(agent.balance || 0) < 25000).length;
  const avgFloat = agents.length ? totalNetworkFloat / agents.length : 0;
  const avgCash = agents.length ? totalNetworkCash / agents.length : 0;

  const totalTopups = transactions.filter((item) => item.type === 'topup').reduce((sum, item) => sum + item.amount, 0);
  const totalOperated = Math.abs(transactions.filter((item) => item.type === 'transfer').reduce((sum, item) => sum + item.amount, 0));
  const currentAgentBalance = agentBalance?.balance || 0;
  const currentAgentCash = agentBalance?.cash_balance || 0;

  const currencySnapshots = clientBalances.map((item) => ({
    currency: item.currency,
    available: Math.max(Number(item.balance || 0) - Number(item.reserved_balance || 0), 0),
    reserved: Number(item.reserved_balance || 0),
    gross: Number(item.balance || 0),
  }));
  const primaryClientCurrency = currencySnapshots.find((item) => item.currency === 'XAF') || currencySnapshots[0];
  const confirmedClientTransfers = clientTransfers.filter((transfer) => transfer.status === 'completed').length;
  const pendingClientTransfers = clientTransfers.filter((transfer) => transfer.status === 'created' || transfer.status === 'available_for_pickup').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-4xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="space-y-8">
        <section className="rounded-4xl border border-border/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(248,250,252,0.72))] p-6 shadow-2xl shadow-slate-200/40 backdrop-blur-xl dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.10),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.82))] dark:shadow-black/20 md:p-8">
          <Badge className="rounded-full border border-white/30 bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            Tesorería central
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Gestión de float y disponibilidad</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
            Controla la liquidez de la red, detecta gestores por debajo del umbral operativo y ejecuta recargas con confirmación.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Float de red" value={formatCurrency(totalNetworkFloat)} hint="Saldo agregado de gestores" icon={Landmark} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
          <SummaryCard label="Efectivo en red" value={formatCurrency(totalNetworkCash)} hint="Caja total declarada" icon={Banknote} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
          <SummaryCard label="Gestores activos" value={String(agents.filter((agent) => agent.is_active).length)} hint="Con cuenta habilitada" icon={Wallet} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
          <SummaryCard label="Umbral crítico" value={String(lowFloatAgents)} hint="Por debajo de 25.000 XAF" icon={ShieldAlert} tone="border-amber-500/20 bg-amber-500 shadow-amber-500/20" />
          <SummaryCard label="Float medio" value={formatCurrency(avgFloat)} hint={`Efectivo medio ${formatCurrency(avgCash)}`} icon={TrendingUp} tone="border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20" />
        </section>

        <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Wallet className="h-5 w-5 text-primary" />
              Disponibilidad por gestor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/5 hover:bg-transparent">
                    <TableHead className="pl-8 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Gestor</TableHead>
                    <TableHead className="py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Contacto</TableHead>
                    <TableHead className="py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Estado</TableHead>
                    <TableHead className="py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground text-right">Float</TableHead>
                    <TableHead className="py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground text-right">Efectivo</TableHead>
                    <TableHead className="py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground text-right">Total recargado</TableHead>
                    <TableHead className="pr-8 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const lowFloat = Number(agent.balance || 0) < 25000;
                    return (
                      <TableRow key={agent.id} className="border-border/5 hover:bg-muted/30">
                        <TableCell className="pl-8 py-4">
                          <p className="text-sm font-bold text-foreground">{agent.name}</p>
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">{agent.email}</p>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">{agent.phone}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Badge className={`w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${agent.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                              {agent.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                            {lowFloat && (
                              <Badge className="w-fit rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
                                Bajo float
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="text-base font-bold text-foreground">{formatCurrency(agent.balance)}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="text-base font-bold text-foreground">{formatCurrency(agent.cash_balance || 0)}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="text-base font-bold text-foreground">{formatCurrency(agent.topup_total || 0)}</p>
                          {agent.last_topup_at && (
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground">{formatDate(agent.last_topup_at)}</p>
                          )}
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <Button
                            variant="outline"
                            className="rounded-xl font-bold"
                            onClick={() => {
                              setSelectedAgent(agent);
                              setTopUpAmount('');
                              setErrorMessage('');
                              setConfirmOpen(true);
                            }}
                          >
                            Recargar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
              </div>
              <DialogTitle className="text-2xl font-bold text-foreground">Recarga confirmada</DialogTitle>
            </DialogHeader>
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Monto recargado</p>
              <p className="mt-2 text-4xl font-bold text-foreground">{formatCurrency(successAmount)}</p>
            </div>
            <Button className="w-full rounded-2xl font-bold" onClick={() => setSuccessOpen(false)}>
              Cerrar
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground">Recargar saldo a gestor</DialogTitle>
              <DialogDescription className="text-sm font-semibold text-muted-foreground">
                Introduce el importe a añadir al float de {selectedAgent?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="topup-amount" className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Monto a recargar
                </Label>
                <Input
                  id="topup-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={topUpAmount}
                  onChange={(event) => setTopUpAmount(event.target.value)}
                  className="h-14 rounded-2xl text-lg font-bold"
                  placeholder="0.00"
                />
              </div>
              {selectedAgent && (
                <div className="rounded-2xl border border-border/10 bg-background/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saldo actual</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(selectedAgent.balance)}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="rounded-xl font-bold"
                disabled={!topUpAmount || parseFloat(topUpAmount) <= 0}
                onClick={() => {
                  setConfirmOpen(false);
                  setFinalConfirmOpen(true);
                }}
              >
                Continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={finalConfirmOpen} onOpenChange={setFinalConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">Confirmar recarga</DialogTitle>
              <DialogDescription className="text-sm font-semibold text-muted-foreground">
                Esta acción impactará inmediatamente el saldo del gestor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/10 bg-background/70 p-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gestor</p>
                <p className="mt-2 text-lg font-bold text-foreground">{selectedAgent?.name}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Monto</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(parseFloat(topUpAmount) || 0)}</p>
              </div>
              {errorMessage && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/30">
                  {errorMessage}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                disabled={topUpLoading}
                onClick={() => {
                  setFinalConfirmOpen(false);
                  setConfirmOpen(true);
                }}
              >
                Volver
              </Button>
              <Button
                className="rounded-xl font-bold"
                disabled={topUpLoading}
                onClick={async () => {
                  if (!selectedAgent || !topUpAmount || parseFloat(topUpAmount) <= 0) return;

                  setTopUpLoading(true);
                  try {
                    const result = await topUpAgentBalance(selectedAgent.id, parseFloat(topUpAmount));
                    if (!result.success) {
                      setErrorMessage(result.error || 'No se pudo realizar la recarga');
                      return;
                    }

                    const agentsData = await getAgents();
                    setAgents(agentsData);
                    setSuccessAmount(parseFloat(topUpAmount));
                    setFinalConfirmOpen(false);
                    setSuccessOpen(true);
                    setTopUpAmount('');
                    setErrorMessage('');
                  } catch (error) {
                    console.error('Error topping up agent balance:', error);
                    setErrorMessage('Ocurrió un error al ejecutar la recarga.');
                  } finally {
                    setTopUpLoading(false);
                  }
                }}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (isGestor) {
    return (
      <div className="space-y-8">
        <section className="rounded-4xl border border-border/10 bg-card/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8">
          <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            Liquidez del gestor
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Mi billetera operativa</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Consulta tu saldo disponible, el volumen operado y el historial completo de movimientos de caja.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Saldo disponible" value={formatCurrency(currentAgentBalance)} hint="Float utilizable ahora mismo" icon={Wallet} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
          <SummaryCard label="Saldo en efectivo" value={formatCurrency(currentAgentCash)} hint="Caja física disponible" icon={Banknote} tone="border-amber-500/20 bg-amber-500 shadow-amber-500/20" />
          <SummaryCard label="Total recargado" value={formatCurrency(totalTopups)} hint="Recargas acumuladas en cuenta" icon={TrendingUp} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
          <SummaryCard label="Total operado" value={formatCurrency(totalOperated)} hint="Salidas por transferencias" icon={ArrowDownUp} tone="border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20" />
        </section>

        <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-border/5 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <History className="h-5 w-5 text-primary" />
              Movimientos de cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/5 hover:bg-transparent">
                    <TableHead className="pl-8 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Operación</TableHead>
                    <TableHead className="py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Monto</TableHead>
                    <TableHead className="py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Detalle</TableHead>
                    <TableHead className="pr-8 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-16 text-center text-sm font-bold text-muted-foreground">
                        Sin movimientos registrados todavía.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id} className="border-border/5 hover:bg-muted/30">
                        <TableCell className="pl-8">
                          <Badge className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${transaction.amount >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {transactionTypeLabel(transaction.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-bold ${transaction.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {transaction.amount >= 0 ? '+' : ''}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-bold text-foreground">{transaction.description || 'Sin descripción'}</p>
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                            Saldo resultante: {formatCurrency(transaction.new_balance)}
                          </p>
                        </TableCell>
                        <TableCell className="pr-8 text-xs font-semibold text-muted-foreground">{formatDate(transaction.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-4xl border border-border/10 bg-card/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8">
        <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Billetera del cliente
        </Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Saldos por moneda y actividad</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
          Consulta tus fondos disponibles, importes retenidos y el historial de transferencias de billetera y operaciones personales.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Monedas activas" value={String(currencySnapshots.length)} hint="Balances abiertos en cuenta" icon={Banknote} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
        <SummaryCard label="Saldo principal" value={primaryClientCurrency ? formatCurrency(primaryClientCurrency.available, primaryClientCurrency.currency) : '0 XAF'} hint="Disponible en tu moneda principal" icon={Wallet} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
        <SummaryCard label="Reservado" value={primaryClientCurrency ? formatCurrency(primaryClientCurrency.reserved, primaryClientCurrency.currency) : '0 XAF'} hint="Pendiente de confirmación o liberación" icon={Clock3} tone="border-amber-500/20 bg-amber-500 shadow-amber-500/20" />
        <SummaryCard label="Confirmadas" value={String(confirmedClientTransfers)} hint={`${pendingClientTransfers} pendientes`} icon={CheckCircle} tone="border-fuchsia-500/20 bg-fuchsia-500 shadow-fuchsia-500/20" />
      </section>

      <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-border/5 pb-5">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Wallet className="h-5 w-5 text-primary" />
            Saldos por moneda
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {currencySnapshots.map((snapshot) => (
            <div key={snapshot.currency} className="rounded-[1.75rem] border border-border/10 bg-background/70 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{snapshot.currency}</p>
              <p className="mt-3 text-2xl font-bold text-foreground">{formatCurrency(snapshot.available, snapshot.currency)}</p>
              <div className="mt-4 space-y-2 text-xs font-semibold text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Reservado</span>
                  <span className="font-bold text-foreground">{formatCurrency(snapshot.reserved, snapshot.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total bruto</span>
                  <span className="font-bold text-foreground">{formatCurrency(snapshot.gross, snapshot.currency)}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-border/5 pb-5">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <History className="h-5 w-5 text-primary" />
            Operaciones recientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {clientTransfers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/20 bg-background/50 px-6 py-10 text-center text-sm font-bold text-muted-foreground">
              Aún no tienes movimientos registrados.
            </div>
          ) : (
            clientTransfers.slice(0, 12).map((transfer) => (
            <div key={transfer.id} className="rounded-3xl border border-border/10 bg-background/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">{transfer.transfer_code}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {transfer.sender_name} · {transfer.receiver_name}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                      {transfer.destination_city} · {formatDate(transfer.created_at)}
                    </p>
                  </div>
                  <Badge className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getStatusColor(transfer.status)}`}>
                    {transfer.status}
                  </Badge>
                </div>
                <p className="mt-4 text-lg font-bold text-foreground">{formatCurrency(transfer.amount, transfer.currency)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">Recarga confirmada</DialogTitle>
          </DialogHeader>
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Monto recargado</p>
            <p className="mt-2 text-4xl font-bold text-foreground">{formatCurrency(successAmount)}</p>
          </div>
          <Button className="w-full rounded-2xl font-bold" onClick={() => setSuccessOpen(false)}>
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Recargar saldo a gestor</DialogTitle>
            <DialogDescription className="text-sm font-semibold text-muted-foreground">
              Introduce el importe a añadir al float de {selectedAgent?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="topup-amount" className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Monto a recargar
              </Label>
              <Input
                id="topup-amount"
                type="number"
                min="1"
                step="0.01"
                value={topUpAmount}
                onChange={(event) => setTopUpAmount(event.target.value)}
                className="h-14 rounded-2xl text-lg font-bold"
                placeholder="0.00"
              />
            </div>
            {selectedAgent && (
              <div className="rounded-2xl border border-border/10 bg-background/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saldo actual</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(selectedAgent.balance)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold"
              disabled={!topUpAmount || parseFloat(topUpAmount) <= 0}
              onClick={() => {
                setConfirmOpen(false);
                setFinalConfirmOpen(true);
              }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finalConfirmOpen} onOpenChange={setFinalConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">Confirmar recarga</DialogTitle>
            <DialogDescription className="text-sm font-semibold text-muted-foreground">
              Esta acción impactará inmediatamente el saldo del gestor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/10 bg-background/70 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gestor</p>
              <p className="mt-2 text-lg font-bold text-foreground">{selectedAgent?.name}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Monto</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(parseFloat(topUpAmount) || 0)}</p>
            </div>
            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/30">
                {errorMessage}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              disabled={topUpLoading}
              onClick={() => {
                setFinalConfirmOpen(false);
                setConfirmOpen(true);
              }}
            >
              Volver
            </Button>
            <Button
              className="rounded-xl font-bold"
              disabled={topUpLoading}
              onClick={async () => {
                if (!selectedAgent || !topUpAmount || parseFloat(topUpAmount) <= 0) return;

                setTopUpLoading(true);
                try {
                  const result = await topUpAgentBalance(selectedAgent.id, parseFloat(topUpAmount));
                  if (!result.success) {
                    setErrorMessage(result.error || 'No se pudo realizar la recarga');
                    return;
                  }

                  const agentsData = await getAgents();
                  setAgents(agentsData);
                  setSuccessAmount(parseFloat(topUpAmount));
                  setFinalConfirmOpen(false);
                  setSuccessOpen(true);
                  setTopUpAmount('');
                  setErrorMessage('');
                } catch (error) {
                  console.error('Error topping up agent balance:', error);
                  setErrorMessage('Ocurrió un error al ejecutar la recarga.');
                } finally {
                  setTopUpLoading(false);
                }
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
