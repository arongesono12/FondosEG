'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAgents, toggleAgentStatus, topUpAgentBalance, resetAgentBalance, createAgent } from '@/services/agent';
import { formatCurrency } from '@/lib/utils';
import type { AgentWithBalance, UserRole } from '@/types';
import { ArrowUpRight, Users, CheckCircle, AlertCircle } from '@/components/ui/hugeicons';
import { useAppStore } from '@/lib/store';
import { isAdminRole } from '@/lib/roles';
import { MetricBars, MetricCard, MetricDesk, MetricRate, MetricTiles, ModuleMetrics, ModuleMetricsSkeleton } from '@/components/dashboard/module-metric-card';
import { AgentsRecordPanel } from '@/components/dashboard/panels/agent-record-panels';
import { rankedSeries, shareOf } from '@/lib/dashboard-series';
import { LOW_FLOAT_THRESHOLD } from '@/lib/financial';

export default function AgentsPage() {
  const { user } = useAppStore();
  const [agents, setAgents] = useState<AgentWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentWithBalance | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetAmount, setResetAmount] = useState('0');
  const [resetLoading, setResetLoading] = useState(false);

  const [newAgent, setNewAgent] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    document_type: 'dni',
    document_number: '',
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await getAgents();
      setAgents(data);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const result = await createAgent({
        ...newAgent,
        role: 'gestor' as UserRole,
        country: '',
        city: '',
      });
      if (result.success) {
        await loadAgents();
        setIsCreateOpen(false);
        setNewAgent({ name: '', email: '', phone: '', password: '', document_type: 'dni', document_number: '' });
      } else {
        setCreateError(result.error || 'No se pudo crear el gestor');
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      setCreateError(error instanceof Error ? error.message : 'No se pudo crear el gestor');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (agentId: string, currentStatus: boolean) => {
    try {
      await toggleAgentStatus(agentId, !currentStatus);
      await loadAgents();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleTopUp = async () => {
    if (!selectedAgent || !topUpAmount || parseFloat(topUpAmount) <= 0) return;
    setTopUpLoading(true);
    setErrorMessage('');
    try {
      const result = await topUpAgentBalance(selectedAgent.id, parseFloat(topUpAmount));
      if (result.success) {
        await loadAgents();
        setSuccessAmount(parseFloat(topUpAmount));
        setTopUpOpen(false);
        setSuccessOpen(true);
        setTopUpAmount('');
        setSelectedAgent(null);
      } else {
        setErrorMessage(result.error || 'Error al recargar el saldo');
      }
    } catch (error) {
      console.error('Error topping up:', error);
      setErrorMessage('Error al conectar con el servidor');
    } finally {
      setTopUpLoading(false);
    }
  };

  const handleReset = async () => {
    if (!selectedAgent) return;
    setResetLoading(true);
    setErrorMessage('');
    try {
      const newBalance = parseFloat(resetAmount) || 0;
      const result = await resetAgentBalance(selectedAgent.id, user?.id || '', newBalance);
      if (result.success) {
        await loadAgents();
        setResetOpen(false);
        setResetAmount('0');
        setSelectedAgent(null);
        alert(`Saldo restablecido a ${formatCurrency(newBalance)}`);
      } else {
        setErrorMessage(result.error || 'Error al restablecer el saldo');
      }
    } catch (error) {
      console.error('Error resetting balance:', error);
      setErrorMessage('Error al conectar con el servidor');
    } finally {
      setResetLoading(false);
    }
  };


  // Las tarjetas resumen toda la red; el buscador sólo filtra la lista de gestores.
  const totalFloat = agents.reduce((sum, agent) => sum + Number(agent.balance || 0), 0);
  const totalCash = agents.reduce((sum, agent) => sum + Number(agent.cash_balance || 0), 0);
  const activeAgents = agents.filter((agent) => agent.is_active).length;
  const lowFloatAgents = agents.filter((agent) => Number(agent.balance || 0) < LOW_FLOAT_THRESHOLD).length;

  if (!isAdminRole(user?.role)) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Acceso denegado</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Esta página solo es accesible para administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <ModuleMetricsSkeleton />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* `@xl:` mira el contenedor de la página, no la ventana. */}
      <div className="flex flex-col gap-4 @xl:flex-row @xl:items-center @xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Gestores</h1>
          <p className="text-muted-foreground">
            Administra los gestores del sistema
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setCreateError('');
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full shrink-0 bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25 sm:w-auto">
              Nuevo gestor
            </Button>
          </DialogTrigger>
          <DialogContent size="md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Crear nuevo gestor</DialogTitle>
            </DialogHeader>
            <DialogBody>
              {/* El botón de envío va en el pie y se enlaza con `form`. */}
              <form id="agent-create-form" onSubmit={handleCreateAgent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newAgent.email}
                    onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={newAgent.phone}
                    onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newAgent.password}
                    onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 @xs:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="doc_type">Tipo documento</Label>
                    <Select
                      value={newAgent.document_type}
                      onValueChange={(v) => setNewAgent({ ...newAgent, document_type: v })}
                    >
                      <SelectTrigger id="doc_type" className="bg-muted/20 border-border/10 focus:ring-primary/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dni">DNI</SelectItem>
                        <SelectItem value="nie">NIE</SelectItem>
                        <SelectItem value="pasaporte">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doc_number">Número</Label>
                    <Input
                      id="doc_number"
                      value={newAgent.document_number}
                      onChange={(e) => setNewAgent({ ...newAgent, document_number: e.target.value })}
                    />
                  </div>
                </div>
                {createError && (
                  <p className="text-sm font-semibold text-rose-500">{createError}</p>
                )}
              </form>
            </DialogBody>
            <DialogFooter>
              <Button type="submit" form="agent-create-form" className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25" disabled={creating}>
                {creating ? 'Creando...' : 'Crear gestor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ModuleMetrics label="Resumen de gestores">
        <MetricCard layout="desk" title="Efectivo en red" value={formatCurrency(totalCash)} caption="Caja total declarada">
          <MetricDesk />
        </MetricCard>
        <MetricCard
          title="Float de red"
          value={formatCurrency(totalFloat)}
          caption={<><span className="overview-tone-primary">{agents.length} gestores</span> saldo agregado</>}
        >
          <MetricBars data={rankedSeries(agents, (agent) => agent.name, (agent) => Number(agent.balance || 0))} seriesLabel="Float" format={formatCurrency} />
        </MetricCard>
        <MetricCard title="Bajo umbral" value={String(lowFloatAgents)} caption={`Por debajo de ${formatCurrency(LOW_FLOAT_THRESHOLD)}`}>
          <MetricRate value={shareOf(lowFloatAgents, agents.length)} label={`${shareOf(lowFloatAgents, agents.length)}% de los gestores bajo el umbral`} />
        </MetricCard>
        <MetricCard
          layout="tiles"
          title="Gestores activos"
          value={String(activeAgents)}
          caption="Con cuenta habilitada"
          action={{ href: '/balance', label: 'Ver disponibilidad por gestor', icon: <ArrowUpRight /> }}
        >
          <MetricTiles tiles={[
            { icon: <Users />, title: 'Total', detail: String(agents.length) },
            { icon: <CheckCircle />, title: 'Activos', detail: String(activeAgents), featured: true },
            { icon: <AlertCircle />, title: 'Inactivos', detail: String(agents.length - activeAgents) },
          ]} />
        </MetricCard>
      </ModuleMetrics>

      <AgentsRecordPanel
        agents={agents}
        onToggleStatus={(agent) => handleToggleStatus(agent.id, agent.is_active)}
        onResetBalance={(agent) => {
          setSelectedAgent(agent);
          setResetAmount(agent.balance.toString());
          setResetOpen(true);
        }}
        onTopUp={(agent) => {
          setSelectedAgent(agent);
          setTopUpOpen(true);
        }}
      />

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent size="md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Recargar saldo</DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <>
              <DialogBody className="space-y-4">
                <div className="dashboard-inset p-4 bg-muted rounded-lg">
                  <p className="font-medium wrap-break-word">{selectedAgent.name}</p>
                  <p className="text-sm text-muted-foreground">Saldo actual: {formatCurrency(selectedAgent.balance)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topup_amount">Monto a recargar</Label>
                  <Input
                    id="topup_amount"
                    type="number"
                    inputMode="decimal"
                    onWheel={(e) => e.currentTarget.blur()}
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                  />
                </div>
                {errorMessage && (
                  <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorMessage}
                  </div>
                )}
              </DialogBody>
              <DialogFooter>
                <Button
                  className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25"
                  onClick={handleTopUp}
                  disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || topUpLoading}
                >
                  {topUpLoading ? 'Recargando...' : 'Recargar saldo'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-green-600">
              Recarga exitosa
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="text-center py-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <p className="text-center text-muted-foreground">
              Se ha recargado exitosamente el saldo del gestor.
            </p>
            <div className="dashboard-inset p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Monto recargado</p>
              <p className="text-2xl font-bold text-green-600 tabular-nums wrap-break-word">{formatCurrency(successAmount)}</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25" onClick={() => setSuccessOpen(false)}>
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent size="md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              Restablecer saldo
            </DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <>
              <DialogBody className="space-y-4">
                <div className="dashboard-inset p-4 bg-muted rounded-lg">
                  <p className="font-medium wrap-break-word">{selectedAgent.name}</p>
                  <p className="text-sm text-muted-foreground">Saldo actual: {formatCurrency(selectedAgent.balance)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset_amount">Nuevo saldo</Label>
                  <Input
                    id="reset_amount"
                    type="number"
                    inputMode="decimal"
                    onWheel={(e) => e.currentTarget.blur()}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={resetAmount}
                    onChange={(e) => setResetAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ingrese 0 para dejar el saldo en cero
                  </p>
                </div>
                {errorMessage && (
                  <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorMessage}
                  </div>
                )}
              </DialogBody>
              <DialogFooter>
                <Button
                  className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25"
                  onClick={handleReset}
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Restableciendo...' : 'Restablecer saldo'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
