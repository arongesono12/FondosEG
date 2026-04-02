'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getDailyTransferStats, getAgentTransferStats, getRecentTransfers } from '@/services/dashboard';
import type { DailyTransferStats, AgentTransferStats, Transfer } from '@/types';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { HttpError } from '@/services/http';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { TrendingUp, Users, Send, DollarSign, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const THEME_COLORS = [
  '#2a215b', // Primary Indigo
  '#6366f1', // Indigo 500
  '#ec4899', // Pink 500
  '#f43f5e', // Rose 500
  '#a855f7', // Purple 500
];

export default function StatsPage() {
  const [dailyStats, setDailyStats] = useState<DailyTransferStats[]>([]);
  const [agentStats, setAgentStats] = useState<AgentTransferStats[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [daily, agents, recent] = await Promise.all([
          getDailyTransferStats(30),
          getAgentTransferStats(),
          getRecentTransfers(10),
        ]);
        setDailyStats(daily);
        setAgentStats(agents);
        setRecentTransfers(recent);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) {
          console.error('Error loading stats:', error);
        }
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const totalAmount = dailyStats.reduce((sum, d) => sum + d.total_amount, 0);
  const totalTransfers = dailyStats.reduce((sum, d) => sum + d.transfer_count, 0);

  const chartData = dailyStats.map((d) => ({
    date: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
    amount: d.total_amount,
    count: d.transfer_count,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground font-semibold">Analizando datos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-primary">Estadísticas de Red</h1>
        <p className="text-muted-foreground font-bold text-sm">Análisis detallado de flujos y rendimiento del sistema en los últimos 30 días.</p>
      </div>

      {/* Summary Chips */}
      <div className="grid gap-6 md:grid-cols-4">
        {[
          { label: 'Transferencias', value: totalTransfers, icon: Send, color: 'bg-task-blue-fg', bg: 'bg-task-blue-bg' },
          { label: 'Volumen Total', value: formatCurrency(totalAmount), icon: DollarSign, color: 'bg-task-purple-fg', bg: 'bg-task-purple-bg' },
          { label: 'Gestores Activos', value: agentStats.length, icon: Users, color: 'bg-primary', bg: 'bg-white/40' },
          { label: 'Ticket Promedio', value: totalTransfers > 0 ? formatCurrency(totalAmount / totalTransfers) : formatCurrency(0), icon: TrendingUp, color: 'bg-task-coral-fg', bg: 'bg-task-coral-bg' }
        ].map((item, i) => (
          <Card key={i} className={`glass-premium relative border-border/10 ${item.bg}/20`}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${item.color} text-white shadow-lg shadow-black/5`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">{item.label}</p>
                <p className="text-xl font-black text-primary mt-0.5">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-border/10 bg-card/40 glass shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Flujo de Volumen
            </CardTitle>
            <CardDescription className="font-bold text-xs">Monto acumulado por día (30 días)</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/20" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: 'currentColor', fontWeight: 800 }} 
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: 'currentColor', fontWeight: 800 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${val / 1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      backdropFilter: 'blur(8px)',
                      borderRadius: '16px', 
                      border: '1px solid var(--border)',
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                    labelStyle={{ fontWeight: 900, color: 'var(--foreground)', marginBottom: '4px' }}
                    itemStyle={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '12px' }}
                    cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="var(--primary)" 
                    strokeWidth={4}
                    dot={{ fill: 'var(--primary)', strokeWidth: 2, r: 4, stroke: 'var(--card)' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 bg-card/40 glass shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-primary flex items-center gap-2">
               <PieChartIcon className="h-5 w-5" /> Distribución por Gestor
            </CardTitle>
            <CardDescription className="font-bold text-xs">Aportación al volumen total de red</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agentStats.slice(0, 5)}
                    dataKey="total_sent"
                    nameKey="agent_name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                  >
                    {agentStats.slice(0, 5).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={THEME_COLORS[index % THEME_COLORS.length]} className="stroke-none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      backdropFilter: 'blur(8px)',
                      borderRadius: '16px', 
                      border: '1px solid var(--border)',
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)'
                    }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 mt-4 px-4">
               {agentStats.slice(0, 5).map((agent, i) => (
                 <div key={i} className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full" style={{ backgroundColor: THEME_COLORS[i % THEME_COLORS.length] }} />
                   <span className="text-[10px] font-black text-primary truncate max-w-[80px]">{agent.agent_name}</span>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Ranking & Recent Activity */}
      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-1 glass-premium relative">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-primary">Top Gestores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {agentStats.slice(0, 5).map((agent, index) => (
              <div key={agent.agent_id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/5 text-primary text-xs font-black shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                    #{index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-black text-primary">{agent.agent_name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                      {agent.transfer_count} Op.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-primary">{formatCurrency(agent.total_sent)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 glass-premium relative">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-primary">Operaciones Recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {recentTransfers.map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between py-4 px-8 border-b border-border/5 transition-colors hover:bg-muted/30 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-black text-primary">{transfer.transfer_code}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        {transfer.sender_name} → {transfer.receiver_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-6">
                    <div>
                      <p className="text-sm font-black text-primary">{formatCurrency(transfer.amount)}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">{formatDate(transfer.created_at)}</p>
                    </div>
                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${getStatusColor(transfer.status)}`}>
                      {transfer.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
