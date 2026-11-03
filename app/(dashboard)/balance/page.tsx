'use client';

import { MetricArea, MetricBars, MetricCard, MetricDesk, MetricRate, MetricTiles, ModuleMetrics, ModuleMetricsSkeleton } from '@/components/dashboard/module-metric-card';
import { AgentAvailabilityPanel } from '@/components/dashboard/panels/agent-record-panels';
import { AccountMovementsPanel, CurrencyBalancesPanel, WithdrawalsPanel } from '@/components/dashboard/panels/balance-record-panels';
import { RecentTransfersPanel } from '@/components/dashboard/transfer-record-panel';
import { lastDaysSeries, rankedSeries, shareOf } from '@/lib/dashboard-series';
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getAgentBalance, getAgentTransactions, getAgents, topUpAgentBalance } from '@/services/agent';
import { getTransfers } from '@/modules/transfers/http/client';
import { fetchJSON } from '@/services/http';
import { formatCurrency } from '@/lib/utils';
import { getAvailableClientBalance, LOW_FLOAT_THRESHOLD } from '@/lib/financial';
import { ClientWithdrawalModal } from '@/components/client-withdrawal-modal';
import type { AgentBalance, AgentWithBalance, BalanceTransaction, ClientBalance, ClientWithdrawal, Transfer } from '@/types';
import { isAdminRole } from '@/lib/roles';
import { AlertCircle, ArrowUpRight, Banknote, CheckCircle, Landmark, Receipt, Users, Wallet } from '@/components/ui/hugeicons';

type BalanceResponse = { balances: ClientBalance[] };




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
  const [withdrawals, setWithdrawals] = useState<ClientWithdrawal[]>([]);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);

  const isAdmin = isAdminRole(user?.role);
  const isGestor = user?.role === 'gestor';
  const isClient = user?.role === 'cliente';

  const loadData = useCallback(async () => {
    if (!user) return;

    // `loading` empieza en true y no se reactiva: al refrescar tras un retiro, el
    // esqueleto desmontaría las tarjetas y perderían la selección y la pestaña.
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

      // Los retiros se piden PRIMERO: ese endpoint libera las retenciones
      // caducadas, así que el saldo que se lea después ya no descuenta vales
      // muertos.
      const withdrawalsData = await fetchJSON<ClientWithdrawal[]>('/api/withdrawals').catch((error) => {
        console.error('Error loading withdrawals:', error);
        return [] as ClientWithdrawal[];
      });
      const [balancesData, transfersData] = await Promise.all([
        fetchJSON<BalanceResponse>(`/api/balance?userId=${encodeURIComponent(user.id)}`),
        getTransfers(50),
      ]);
      setWithdrawals(withdrawalsData);
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
  const lowFloatAgents = agents.filter((agent) => Number(agent.balance || 0) < LOW_FLOAT_THRESHOLD).length;
  const avgFloat = agents.length ? totalNetworkFloat / agents.length : 0;
  const avgCash = agents.length ? totalNetworkCash / agents.length : 0;

  const totalTopups = transactions.filter((item) => item.type === 'topup').reduce((sum, item) => sum + item.amount, 0);
  const totalOperated = Math.abs(transactions.filter((item) => item.type === 'transfer').reduce((sum, item) => sum + item.amount, 0));
  const currentAgentBalance = agentBalance?.balance || 0;
  const currentAgentCash = agentBalance?.cash_balance || 0;

  const currencySnapshots = clientBalances.map((item) => ({
    currency: item.currency,
    available: getAvailableClientBalance(Number(item.balance || 0), Number(item.reserved_balance || 0)),
    reserved: Number(item.reserved_balance || 0),
    gross: Number(item.balance || 0),
  }));
  const primaryClientCurrency = currencySnapshots.find((item) => item.currency === 'XAF') || currencySnapshots[0];
  const confirmedClientTransfers = clientTransfers.filter((transfer) => transfer.status === 'completed').length;
  const pendingClientTransfers = clientTransfers.filter((transfer) => transfer.status === 'created' || transfer.status === 'available_for_pickup').length;
  const reservedShare = primaryClientCurrency ? shareOf(primaryClientCurrency.reserved, primaryClientCurrency.gross) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-4xl" />
        <ModuleMetricsSkeleton />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="space-y-8">
        {/* Variantes de contenedor (`@xl:` ≈ `sm:`, `@4xl:` ≈ `lg:`):
            responden al ancho disponible en la página. */}
        <section className="app-card p-6 @2xl:p-8">
          <Badge className="rounded-full border border-white/30 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            Tesorería central
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Gestión de float y disponibilidad</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
            Controla la liquidez de la red, detecta gestores por debajo del umbral operativo y ejecuta recargas con confirmación.
          </p>
        </section>

        <ModuleMetrics label="Resumen de tesorería">
          <MetricCard layout="desk" title="Efectivo en red" value={formatCurrency(totalNetworkCash)} caption="Caja total declarada">
            <MetricDesk />
          </MetricCard>
          <MetricCard
            title="Float de red"
            value={formatCurrency(totalNetworkFloat)}
            caption={<><span className="overview-tone-primary">{agents.length} gestores</span> saldo agregado</>}
          >
            <MetricBars data={rankedSeries(agents, (agent) => agent.name, (agent) => Number(agent.balance || 0))} seriesLabel="Float" format={formatCurrency} />
          </MetricCard>
          <MetricCard
            title="Umbral crítico"
            value={String(lowFloatAgents)}
            caption={`Por debajo de ${formatCurrency(LOW_FLOAT_THRESHOLD)}`}
          >
            <MetricRate value={shareOf(lowFloatAgents, agents.length)} label={`${shareOf(lowFloatAgents, agents.length)}% de los gestores bajo el umbral`} />
          </MetricCard>
          <MetricCard
            layout="tiles"
            title="Float medio"
            value={formatCurrency(avgFloat)}
            caption={`Efectivo medio ${formatCurrency(avgCash)}`}
            action={{ href: '/agents', label: 'Ir a gestores', icon: <ArrowUpRight /> }}
          >
            <MetricTiles tiles={[
              { icon: <Users />, title: 'Gestores', detail: String(agents.length) },
              { icon: <CheckCircle />, title: 'Activos', detail: String(agents.filter((agent) => agent.is_active).length), featured: true },
              { icon: <AlertCircle />, title: 'Bajo umbral', detail: String(lowFloatAgents) },
            ]} />
          </MetricCard>
        </ModuleMetrics>

        <AgentAvailabilityPanel
          agents={agents}
          onTopUp={(agent) => {
            setSelectedAgent(agent);
            setTopUpAmount('');
            setErrorMessage('');
            setConfirmOpen(true);
          }}
        />

        <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
          <DialogContent size="sm" aria-describedby={undefined}>
            <DialogHeader align="center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
              </div>
              <DialogTitle className="text-2xl font-bold text-foreground">Recarga confirmada</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="dashboard-inset rounded-3xl border p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">Monto recargado</p>
                <p className="mt-2 text-[clamp(1.5rem,7vw,2.25rem)] font-bold tabular-nums text-foreground wrap-break-word">{formatCurrency(successAmount)}</p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button className="w-full rounded-2xl font-bold" onClick={() => setSuccessOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground">Recargar saldo a gestor</DialogTitle>
              <DialogDescription className="text-sm font-semibold text-muted-foreground">
                Introduce el importe a añadir al float de {selectedAgent?.name}.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="topup-amount" className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Monto a recargar
                </Label>
                <Input
                  id="topup-amount"
                  type="number"
                  inputMode="decimal"
                  onWheel={(e) => e.currentTarget.blur()}
                  min="1"
                  step="0.01"
                  value={topUpAmount}
                  onChange={(event) => setTopUpAmount(event.target.value)}
                  className="h-14 rounded-2xl text-lg font-bold"
                  placeholder="0.00"
                />
              </div>
              {selectedAgent && (
                <div className="dashboard-inset rounded-2xl border border-border/10 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saldo actual</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground wrap-break-word">{formatCurrency(selectedAgent.balance)}</p>
                </div>
              )}
            </DialogBody>
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
          <DialogContent size="sm">
            <DialogHeader align="center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">Confirmar recarga</DialogTitle>
              <DialogDescription className="text-sm font-semibold text-muted-foreground">
                Esta acción impactará inmediatamente el saldo del gestor.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="dashboard-inset rounded-2xl border border-border/10 bg-background/70 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gestor</p>
                <p className="mt-2 text-lg font-bold text-foreground wrap-break-word">{selectedAgent?.name}</p>
              </div>
              <div className="dashboard-inset rounded-2xl border p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Monto</p>
                <p className="mt-2 text-[clamp(1.5rem,7vw,2.25rem)] font-bold tabular-nums text-foreground wrap-break-word">{formatCurrency(parseFloat(topUpAmount) || 0)}</p>
              </div>
              {errorMessage && (
                <div className="dashboard-inset rounded-2xl border p-4 text-sm font-bold text-foreground">
                  {errorMessage}
                </div>
              )}
            </DialogBody>
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
        <section className="app-card p-6 @2xl:p-8">
          <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            Liquidez del gestor
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Mi billetera operativa</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Consulta tu saldo disponible, el volumen operado y el historial completo de movimientos de caja.
          </p>
        </section>

        <ModuleMetrics label="Resumen de la billetera">
          <MetricCard layout="desk" title="Saldo en efectivo" value={formatCurrency(currentAgentCash)} caption="Caja física disponible">
            <MetricDesk />
          </MetricCard>
          <MetricCard title="Total recargado" value={formatCurrency(totalTopups)} caption="Recargas acumuladas en cuenta">
            <MetricBars
              data={lastDaysSeries(transactions.filter((item) => item.type === 'topup'), (item) => item.created_at, (item) => item.amount)}
              seriesLabel="Recargas"
              format={formatCurrency}
            />
          </MetricCard>
          <MetricCard title="Total operado" value={formatCurrency(totalOperated)} caption="Salidas por transferencias">
            <MetricArea
              data={lastDaysSeries(transactions.filter((item) => item.type === 'transfer'), (item) => item.created_at, (item) => Math.abs(item.amount))}
              seriesLabel="Operado"
              format={formatCurrency}
              legend="Salidas por día · 7 días"
            />
          </MetricCard>
          <MetricCard
            layout="tiles"
            title="Saldo disponible"
            value={formatCurrency(currentAgentBalance)}
            caption="Float utilizable ahora mismo"
            action={{ href: '/transfers', label: 'Ir a envíos', icon: <ArrowUpRight /> }}
          >
            <MetricTiles tiles={[
              { icon: <Banknote />, title: 'Efectivo', detail: formatCurrency(currentAgentCash) },
              { icon: <Wallet />, title: 'Disponible', detail: 'XAF', featured: true },
              { icon: <Receipt />, title: 'Actividad', detail: 'Ver historial', href: '/history' },
            ]} />
          </MetricCard>
        </ModuleMetrics>

        <AccountMovementsPanel transactions={transactions} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="app-card p-6 @2xl:p-8">
        <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Billetera del cliente
        </Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Saldos por moneda y actividad</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
          Tus fondos son tuyos desde que entran: úsalos en la app o genera tu propio código para retirarlos en efectivo con cualquier gestor.
        </p>
      </section>

      <ModuleMetrics label="Resumen de la billetera">
        <MetricCard layout="desk" title="Monedas activas" value={String(currencySnapshots.length)} caption="Balances abiertos en cuenta">
          <MetricDesk />
        </MetricCard>
        <MetricCard
          title="Confirmadas"
          value={String(confirmedClientTransfers)}
          caption={<><span className="overview-tone-warning">{pendingClientTransfers} pendientes</span> de {clientTransfers.length} cargadas</>}
        >
          <MetricBars data={lastDaysSeries(clientTransfers.filter((transfer) => transfer.status === 'completed'), (transfer) => transfer.created_at, () => 1)} seriesLabel="Confirmadas" />
        </MetricCard>
        <MetricCard
          title="Reservado"
          value={primaryClientCurrency ? formatCurrency(primaryClientCurrency.reserved, primaryClientCurrency.currency) : '0 XAF'}
          caption="Retenido por códigos de retiro u órdenes pendientes"
        >
          <MetricRate value={reservedShare} label={`${reservedShare}% de tu saldo retenido`} />
        </MetricCard>
        <MetricCard
          layout="tiles"
          title="Saldo principal"
          value={primaryClientCurrency ? formatCurrency(primaryClientCurrency.available, primaryClientCurrency.currency) : '0 XAF'}
          caption="Disponible en tu moneda principal"
          action={{ href: '/transfers', label: 'Ir a envíos', icon: <ArrowUpRight /> }}
        >
          <MetricTiles tiles={[
            { icon: <Landmark />, title: 'Capital', detail: primaryClientCurrency ? formatCurrency(primaryClientCurrency.gross, primaryClientCurrency.currency) : '0 XAF' },
            { icon: <Wallet />, title: 'Disponible', detail: primaryClientCurrency?.currency ?? 'XAF', featured: true },
            { icon: <Receipt />, title: 'Actividad', detail: 'Ver historial', href: '/history' },
          ]} />
        </MetricCard>
      </ModuleMetrics>

      <CurrencyBalancesPanel snapshots={currencySnapshots} onGenerateCode={() => setWithdrawalOpen(true)} />

      <WithdrawalsPanel withdrawals={withdrawals.slice(0, 10)} onGenerateCode={() => setWithdrawalOpen(true)} />

      <RecentTransfersPanel
        title="Operaciones recientes"
        transfers={clientTransfers.slice(0, 12)}
        format={formatCurrency}
        emptyMessage="Aún no tienes movimientos registrados."
        newTransfer={{ href: '/transfers' }}
      />

      <ClientWithdrawalModal
        open={withdrawalOpen}
        onOpenChange={setWithdrawalOpen}
        onSuccess={loadData}
      />

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader align="center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">Recarga confirmada</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="dashboard-inset rounded-3xl border p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">Monto recargado</p>
              <p className="mt-2 text-[clamp(1.5rem,7vw,2.25rem)] font-bold tabular-nums text-foreground wrap-break-word">{formatCurrency(successAmount)}</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button className="w-full rounded-2xl font-bold" onClick={() => setSuccessOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Recargar saldo a gestor</DialogTitle>
            <DialogDescription className="text-sm font-semibold text-muted-foreground">
              Introduce el importe a añadir al float de {selectedAgent?.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="topup-amount" className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Monto a recargar
              </Label>
              <Input
                id="topup-amount"
                type="number"
                  inputMode="decimal"
                  onWheel={(e) => e.currentTarget.blur()}
                min="1"
                step="0.01"
                value={topUpAmount}
                onChange={(event) => setTopUpAmount(event.target.value)}
                className="h-14 rounded-2xl text-lg font-bold"
                placeholder="0.00"
              />
            </div>
            {selectedAgent && (
              <div className="dashboard-inset rounded-2xl border border-border/10 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saldo actual</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-foreground wrap-break-word">{formatCurrency(selectedAgent.balance)}</p>
              </div>
            )}
          </DialogBody>
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
        <DialogContent size="sm">
          <DialogHeader align="center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">Confirmar recarga</DialogTitle>
            <DialogDescription className="text-sm font-semibold text-muted-foreground">
              Esta acción impactará inmediatamente el saldo del gestor.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="dashboard-inset rounded-2xl border border-border/10 bg-background/70 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gestor</p>
              <p className="mt-2 text-lg font-bold text-foreground wrap-break-word">{selectedAgent?.name}</p>
            </div>
            <div className="dashboard-inset rounded-2xl border p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Monto</p>
              <p className="mt-2 text-[clamp(1.5rem,7vw,2.25rem)] font-bold tabular-nums text-foreground wrap-break-word">{formatCurrency(parseFloat(topUpAmount) || 0)}</p>
            </div>
            {errorMessage && (
              <div className="dashboard-inset rounded-2xl border p-4 text-sm font-bold text-foreground">
                {errorMessage}
              </div>
            )}
          </DialogBody>
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
