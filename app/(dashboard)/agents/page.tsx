'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAgents, toggleAgentStatus, topUpAgentBalance, resetAgentBalance, createAgent } from '@/services/agent';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { AgentWithBalance, UserRole } from '@/types';
import { Users, Plus, Search, Phone, Mail, CreditCard, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function AgentsPage() {
  const { user } = useAppStore();
  const [agents, setAgents] = useState<AgentWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentWithBalance | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [creating, setCreating] = useState(false);
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
      }
    } catch (error) {
      console.error('Error creating agent:', error);
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

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.phone.includes(searchTerm)
  );

  if (user?.role !== 'admin') {
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
    return <div className="flex items-center justify-center h-64">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestores</h1>
          <p className="text-muted-foreground">
            Administra los gestores del sistema
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25">
              <Plus className="h-4 w-4" />
              Nuevo gestor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nuevo gestor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateAgent} className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doc_type">Tipo documento</Label>
                  <Select
                    value={newAgent.document_type}
                    onValueChange={(v) => setNewAgent({ ...newAgent, document_type: v })}
                  >
                    <SelectTrigger className="bg-muted/20 border-border/10 focus:ring-primary/20">
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
              <Button type="submit" className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25" disabled={creating}>
                {creating ? 'Creando...' : 'Crear gestor'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gestores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gestor</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron gestores
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{agent.role}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3" />
                          {agent.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {agent.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={agent.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggleStatus(agent.id, agent.is_active)}
                      >
                        {agent.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(agent.balance)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(agent.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-pink-200 dark:border-pink-800 hover:bg-linear-to-r hover:from-pink-500/20 hover:to-rose-600/20 hover:border-pink-500/50"
                          onClick={() => {
                            setSelectedAgent(agent);
                            setResetAmount(agent.balance.toString());
                            setResetOpen(true);
                          }}
                          title="Restablecer saldo"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-pink-200 dark:border-pink-800 hover:bg-linear-to-r hover:from-pink-500/20 hover:to-rose-600/20 hover:border-pink-500/50"
                          onClick={() => {
                            setSelectedAgent(agent);
                            setTopUpOpen(true);
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Recargar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recargar saldo</DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedAgent.name}</p>
                <p className="text-sm text-muted-foreground">Saldo actual: {formatCurrency(selectedAgent.balance)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="topup_amount">Monto a recargar</Label>
                <Input
                  id="topup_amount"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                />
              </div>
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  {errorMessage}
                </div>
              )}
              <Button 
                className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25"
                onClick={handleTopUp}
                disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || topUpLoading}
              >
                {topUpLoading ? 'Recargando...' : 'Recargar saldo'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Recarga exitosa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <p className="text-center text-muted-foreground">
              Se ha recargado exitosamente el saldo del gestor.
            </p>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Monto recargado</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(successAmount)}</p>
            </div>
            <Button className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25" onClick={() => setSuccessOpen(false)}>
              Aceptar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Restablecer saldo
            </DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedAgent.name}</p>
                <p className="text-sm text-muted-foreground">Saldo actual: {formatCurrency(selectedAgent.balance)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset_amount">Nuevo saldo</Label>
                <Input
                  id="reset_amount"
                  type="number"
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
                  <AlertCircle className="h-4 w-4" />
                  {errorMessage}
                </div>
              )}
              <Button 
                className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25"
                onClick={handleReset}
                disabled={resetLoading}
              >
                {resetLoading ? 'Restableciendo...' : 'Restablecer saldo'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
