'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { getAgentBalance, getAgentTransactions, topUpAgentBalance, getAgents } from '@/services/agent';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { AgentBalance, BalanceTransaction, AgentWithBalance } from '@/types';
import { Wallet, TrendingUp, ArrowUpDown, CheckCircle, AlertCircle, History, Loader2 } from 'lucide-react';

export default function BalancePage() {
  const { user } = useAppStore();
  const [selectedAgent, setSelectedAgent] = useState<AgentWithBalance | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [balance, setBalance] = useState<AgentBalance | null>(null);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [agents, setAgents] = useState<AgentWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        if (user?.role === 'admin') {
          const agentsData = await getAgents();
          setAgents(agentsData);
        } else {
          const balanceData = await getAgentBalance(user?.id || '');
          setBalance(balanceData);
          const transactionsData = await getAgentTransactions(user?.id || '', 50);
          setTransactions(transactionsData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
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
          <span className="text-muted-foreground font-semibold">Cargando saldos...</span>
        </div>
      </div>
    );
  }

  if (user?.role === 'admin') {
    return (
      <div className="space-y-10 animate-in fade-in duration-700">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Gestión de Tesorería</h1>
          <p className="text-muted-foreground font-bold text-sm">Control integral de saldos y disponibilidad de la red de gestores.</p>
        </div>

        <Card className="glass-premium relative">
          <CardHeader className="border-b border-border/5 pb-6">
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
               <Wallet className="h-5 w-5" /> Disponibilidad por Gestor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/5 hover:bg-transparent">
                    <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider pl-8">Gestor</TableHead>
                    <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider">Contacto</TableHead>
                    <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider">Estado</TableHead>
                    <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider text-right pr-8">Saldo Disponible</TableHead>
                    <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider text-right pr-8">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id} className="border-border/5 hover:bg-muted/30 transition-colors">
                      <TableCell className="py-5 pl-8">
                         <p className="font-black text-foreground text-sm">{agent.name}</p>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase">{agent.email}</p>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-muted-foreground">{agent.phone}</TableCell>
                      <TableCell>
                        <Badge className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest ${agent.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {agent.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="font-black text-foreground text-base">
                          {formatCurrency(agent.balance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs"
                          onClick={() => {
                            setSelectedAgent(agent);
                            setTopUpAmount('');
                            setConfirmOpen(true);
                          }}
                        >
                          Recargar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isGestor = user?.role === 'gestor';

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Mi Billetera</h1>
        <p className="text-muted-foreground font-bold text-sm">
          {isGestor ? 'Gestiona tu liquidez y revisa el historial de movimientos de tu cuenta.' : 'Gestiona tu saldo y revisa el historial de movimientos de tu cuenta.'}
        </p>
      </div>

      <div className={`grid gap-6 ${isGestor ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {[
          { label: 'Saldo Disponible', value: formatCurrency(balance?.balance || 0), icon: Wallet, color: 'bg-primary', bg: 'bg-card/40' },
          ...(isGestor ? [
            { label: 'Total Recargado', value: formatCurrency(transactions.filter(t => t.type === 'topup').reduce((s, t) => s + t.amount, 0)), icon: TrendingUp, color: 'bg-task-blue-fg', bg: 'bg-task-blue-bg' },
            { label: 'Total Operado', value: formatCurrency(Math.abs(transactions.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0))), icon: ArrowUpDown, color: 'bg-task-purple-fg', bg: 'bg-task-purple-bg' }
          ] : [])
        ].map((item, i) => (
          <Card key={i} className={`glass-premium relative ${item.bg}/40`}>
            <CardContent className="p-6 space-y-4">
              <div className={`p-2.5 w-fit rounded-xl ${item.color} text-white shadow-lg shadow-black/5`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</p>
                <p className="text-3xl font-black text-foreground mt-1">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-1">
        <Card className="glass-premium relative">
          <CardHeader className="border-b border-border/5 pb-6">
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5" /> Movimientos de Cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/5 hover:bg-transparent">
                    <TableHead className="py-4 font-black text-muted-foreground text-[10px] uppercase tracking-wider pl-8">Operación</TableHead>
                    <TableHead className="py-4 font-black text-muted-foreground text-[10px] uppercase tracking-wider">Monto</TableHead>
                    <TableHead className="py-4 font-black text-muted-foreground text-[10px] uppercase tracking-wider">Detalle</TableHead>
                    <TableHead className="py-4 font-black text-muted-foreground text-[10px] uppercase tracking-wider pr-8">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-black text-xs uppercase">
                        Sin movimientos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id} className="border-border/5 hover:bg-muted/30 transition-colors">
                        <TableCell className="pl-8">
                          <Badge className={`rounded-xl px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${transaction.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`font-black text-sm ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                           <p className="text-xs font-bold text-foreground max-w-[200px] truncate">{transaction.description || 'Sin descripción'}</p>
                           <p className="text-[9px] font-bold text-muted-foreground uppercase">Saldo: {formatCurrency(transaction.new_balance)}</p>
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground pr-8">
                          {formatDate(transaction.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-md p-10 outline-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <DialogHeader className="flex flex-col items-center">
             <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <CheckCircle className="h-10 w-10 text-green-600" />
             </div>
            <DialogTitle className="text-2xl font-black text-foreground text-center">
              Recarga Confirmada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8 pt-4">
            <div className="bg-primary/5 rounded-3xl p-8 text-center border border-primary/10">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Monto Añadido</p>
              <p className="text-4xl font-black text-foreground">{formatCurrency(successAmount)}</p>
            </div>
            
            <p className="text-center text-sm font-bold text-muted-foreground leading-relaxed">
              El saldo se ha actualizado correctamente en tu billetera <span className="text-brand-gradient">FondosEG</span>.
            </p>

            <Button className="w-full h-14 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/20" onClick={() => setSuccessOpen(false)}>
              Estupendo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md p-8 outline-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">
              Recargar Saldo a Gestor
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-muted-foreground">
              Ingresa el monto que deseas añadir al saldo de {selectedAgent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="space-y-2">
              <Label htmlFor="agent-topup" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider ml-1">Monto a Recargar</Label>
              <div className="relative">
                <Input
                  id="agent-topup"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="h-14 px-6 focus:ring-2 focus:ring-primary/20 transition-all font-black text-xl"
                />
              </div>
            </div>
            {selectedAgent && (
              <div className="p-4 rounded-xl bg-muted/30 border border-border/20">
                <p className="text-xs font-bold text-muted-foreground uppercase">Saldo actual del gestor</p>
                <p className="text-xl font-black text-foreground">{formatCurrency(selectedAgent.balance)}</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-3 sm:justify-end pt-4">
            <Button
              variant="outline"
              className="h-12 rounded-xl font-bold"
              onClick={() => setConfirmOpen(false)}
              disabled={topUpLoading}
            >
              Cancelar
            </Button>
            <Button
              className="h-12 bg-primary text-white rounded-xl font-bold shadow-lg"
              onClick={() => {
                if (!topUpAmount || parseFloat(topUpAmount) <= 0 || !selectedAgent) return;
                setConfirmOpen(false);
                setFinalConfirmOpen(true);
              }}
              disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || topUpLoading}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finalConfirmOpen} onOpenChange={setFinalConfirmOpen}>
        <DialogContent className="max-w-md p-8 outline-none">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl font-black text-foreground text-center">
              Confirmar Recarga de Saldo
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-muted-foreground text-center">
              ¿Estás seguro de que deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Gestor</p>
              <p className="text-lg font-black text-foreground">{selectedAgent?.name}</p>
              <p className="text-xs text-muted-foreground">{selectedAgent?.phone}</p>
            </div>
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
              <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Monto a Recargar</p>
              <p className="text-3xl font-black text-green-600 dark:text-green-400">{formatCurrency(parseFloat(topUpAmount) || 0)}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 text-center">
                Esta acción no se puede deshacer. El saldo será añadido inmediatamente a la cuenta del gestor.
              </p>
            </div>
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/20">
                <AlertCircle className="h-4 w-4" />
                <span className="font-bold">{errorMessage}</span>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-3 sm:justify-end pt-4">
            <Button
              variant="outline"
              className="h-12 rounded-xl font-bold"
              onClick={() => {
                setFinalConfirmOpen(false);
                setConfirmOpen(true);
              }}
              disabled={topUpLoading}
            >
              Volver
            </Button>
            <Button
              className="h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg"
              onClick={async () => {
                if (!topUpAmount || parseFloat(topUpAmount) <= 0 || !selectedAgent) return;
                setTopUpLoading(true);
                try {
                  const result = await topUpAgentBalance(selectedAgent.id, parseFloat(topUpAmount));
                  if (result.success) {
                    const agentsData = await getAgents();
                    setAgents(agentsData);
                    setSuccessAmount(parseFloat(topUpAmount));
                    setSuccessOpen(true);
                    setFinalConfirmOpen(false);
                    setTopUpAmount('');
                  } else {
                    setErrorMessage(result.error || 'Error al recargar el saldo');
                  }
                } catch (error) {
                  console.error('Error topping up:', error);
                  setErrorMessage('Error al conectar con el servidor');
                } finally {
                  setTopUpLoading(false);
                }
              }}
              disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || topUpLoading}
            >
              {topUpLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Procesando...
                </>
              ) : (
                'Confirmar y Recargar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
