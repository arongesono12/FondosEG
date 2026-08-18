'use client';

import { useState, useEffect } from 'react';
import { cn, getInitials, formatCurrency, convertCurrency, formatDateShort, formatDateWithWeekday } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ModalListSkeleton, PanelSkeleton } from '@/components/skeletons/app-skeletons';
import {
  X,
  TrendingUp,
  Send,
  ShieldAlert,
  MessageSquare,
  Calendar,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import type { AgentsCommissionStats, Transfer, DashboardStats } from '@/types';
import { isAdminRole } from '@/lib/roles';

/* -----------------------------------------------------------------
   Shared Drawer Wrapper
----------------------------------------------------------------- */
function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside
        aria-hidden={!open}
        className={cn(
          'dashboard-drawer fixed right-0 top-0 z-50 h-dvh w-[480px] max-w-full bg-card border-l border-border/20 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="dashboard-drawer-header flex items-start justify-between p-6 border-b border-border/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground font-bold">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground mt-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Scrollable Body */}
        <div className="dashboard-drawer-body flex-1 overflow-y-auto p-6 space-y-4">
          {children}
        </div>
      </aside>
    </>
  );
}

/* -----------------------------------------------------------------
   Status Badge
----------------------------------------------------------------- */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    completed: { label: 'Completado', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
    created:   { label: 'Pendiente',  cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',   icon: Clock       },
    cancelled: { label: 'Cancelado',  cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',         icon: XCircle     },
  };
  const { label, cls, icon: Icon } = map[status] ?? map.created;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border', cls)}>
      <Icon className="h-2.5 w-2.5" /> {label}
    </span>
  );
}

/* -----------------------------------------------------------------
   1. FLUJO DEL DÍA
----------------------------------------------------------------- */
interface FlujoDiaModalProps {
  open: boolean;
  onClose: () => void;
  stats: DashboardStats | null;
  preferredCurrency: string;
}

export function FlujoDiaModal({ open, onClose, stats, preferredCurrency }: FlujoDiaModalProps) {
  const fmt = (n: number) => formatCurrency(convertCurrency(n, 'XAF', preferredCurrency), preferredCurrency);

  const cards = [
    {
      label: 'Capital Total',
      value: fmt(stats?.totalBalance || 0),
      sub: 'Saldo disponible acumulado',
      color: 'blue',
      pct: 75,
      icon: TrendingUp,
    },
    {
      label: 'Enviado Hoy',
      value: fmt(stats?.totalSent || 0),
      sub: 'Volumen procesado en el período',
      color: 'purple',
      pct: 45,
      icon: Send,
    },
    {
      label: 'Operaciones',
      value: String(stats?.todayTransfers || 0),
      sub: 'Total de transacciones',
      color: 'orange',
      pct: 60,
      icon: BarChart3,
    },
    {
      label: 'Comisiones',
      value: fmt(stats?.totalCommission || 0),
      sub: 'Comisiones generadas totales',
      color: 'green',
      pct: 80,
      icon: ArrowUpRight,
    },
    {
      label: 'Comisión Hoy',
      value: fmt(stats?.todayCommission || 0),
      sub: 'Comisiones del día',
      color: 'pink',
      pct: 30,
      icon: TrendingUp,
    },
    {
      label: 'Por Transferencia',
      value: fmt(stats?.commissionPerTransfer || 0),
      sub: 'Comisión promedio por envío',
      color: 'rose',
      pct: 55,
      icon: ArrowUpRight,
    },
  ];

  const colorMap: Record<string, string> = {
    blue:   'bg-blue-500/10 border-blue-500/20 text-blue-500',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-500',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-500',
    green:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
    pink:   'bg-pink-500/10 border-pink-500/20 text-pink-500',
    rose:   'bg-rose-500/10 border-rose-500/20 text-rose-500',
  };

  const barMap: Record<string, string> = {
    blue: 'bg-blue-500', purple: 'bg-purple-500', orange: 'bg-orange-500',
    green: 'bg-emerald-500', pink: 'bg-pink-500', rose: 'bg-rose-500',
  };

  return (
    <Drawer open={open} onClose={onClose} title="Flujo del Día" subtitle="Resumen financiero completo" icon={TrendingUp}>
      <div className="grid grid-cols-1 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={cn('p-5 rounded-2xl border flex flex-col gap-3', colorMap[c.color])}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider opacity-70">{c.label}</p>
                  <p className="text-2xl font-black text-foreground mt-0.5">{c.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
                </div>
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', colorMap[c.color])}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-700', barMap[c.color])} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

/* -----------------------------------------------------------------
   2. ENVÍOS DE GESTORES
----------------------------------------------------------------- */
interface GestoresModalProps {
  open: boolean;
  onClose: () => void;
  userRole?: string;
  preferredCurrency: string;
}

export function GestoresModal({ open, onClose, userRole, preferredCurrency }: GestoresModalProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const fmt = (n: number) => formatCurrency(convertCurrency(n, 'XAF', preferredCurrency), preferredCurrency);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/all-transfers?limit=50')
      .then((r) => r.json())
      .then((data: unknown) => setTransfers(Array.isArray(data) ? (data as Transfer[]) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const subtitle = isAdminRole(userRole)
    ? 'Vista de supervisión — todos los envíos de gestores'
    : 'Tus transferencias recientes';

  return (
    <Drawer open={open} onClose={onClose} title="Envíos de Gestores" subtitle={subtitle} icon={Send}>
      {isAdminRole(userRole) && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wide">
            Modo supervisión — Los administradores no realizan envíos directamente
          </span>
        </div>
      )}

      {loading ? (
        <ModalListSkeleton rows={5} />
      ) : transfers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-bold">No hay transferencias</p>
        </div>
      ) : (
        transfers.map((t) => (
          <div key={t.id} className="p-4 rounded-2xl border border-border/20 bg-card/60 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-border/20 shrink-0">
                  <AvatarFallback className="bg-brand-gradient text-white text-xs font-bold">
                    {getInitials(t.receiver_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-black text-foreground">{t.receiver_name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{t.destination_city}</p>
                  {t.agent?.name && (
                    <p className="text-[10px] text-primary font-black uppercase">Gestor: {t.agent.name}</p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black">{fmt(t.amount)}</p>
                <StatusBadge status={t.status} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/10">
              <span className="text-[10px] font-bold text-muted-foreground font-mono">#{t.transfer_code}</span>
              <span className="text-[10px] font-bold text-muted-foreground">
                {formatDateShort(t.created_at)}
              </span>
            </div>
          </div>
        ))
      )}
    </Drawer>
  );
}

/* -----------------------------------------------------------------
   3. VOLUMEN SEMANAL
----------------------------------------------------------------- */
interface VolumenSemanalModalProps {
  open: boolean;
  onClose: () => void;
  preferredCurrency: string;
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function VolumenSemanalModal({ open, onClose, preferredCurrency }: VolumenSemanalModalProps) {
  const [data, setData] = useState<Array<{ date: string; transfer_count: number; total_amount: number }>>([]);
  const [loading, setLoading] = useState(false);
  const fmt = (n: number) => formatCurrency(convertCurrency(n, 'XAF', preferredCurrency), preferredCurrency);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/weekly-transfers')
      .then((r) => r.json())
      .then((d) => setData(d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const maxAmount = Math.max(...data.map((d) => d.total_amount), 1);

  const totals = data.reduce(
    (acc, d) => ({ count: acc.count + d.transfer_count, amount: acc.amount + d.total_amount }),
    { count: 0, amount: 0 }
  );

  return (
    <Drawer open={open} onClose={onClose} title="Volumen Semanal" subtitle="Actividad de los últimos 7 días" icon={BarChart3}>
      {loading ? (
        <PanelSkeleton rows={5} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
              <p className="text-[10px] font-black uppercase text-rose-500 tracking-wide">Total Envíos</p>
              <p className="text-2xl font-black text-foreground mt-1">{totals.count}</p>
              <p className="text-[10px] text-muted-foreground">en los últimos 7 días</p>
            </div>
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-[10px] font-black uppercase text-blue-500 tracking-wide">Volumen Total</p>
              <p className="text-xl font-black text-foreground mt-1">{fmt(totals.amount)}</p>
              <p className="text-[10px] text-muted-foreground">acumulado semanal</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="p-5 rounded-2xl bg-card border border-border/20">
            <h3 className="text-xs font-black uppercase text-muted-foreground mb-4 tracking-wide">Volumen por día</h3>
            <div className="flex items-end gap-2 h-36">
              {data.map((d, i) => {
                const pct = maxAmount > 0 ? (d.total_amount / maxAmount) * 100 : 0;
                const dayName = DAYS_ES[new Date(d.date).getDay()];
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[9px] font-black text-muted-foreground">{d.transfer_count}</span>
                    <div className="w-full relative flex flex-col justify-end h-28">
                      <div className="absolute inset-x-0 bottom-0 bg-muted/30 rounded-xl h-full" />
                      <div
                        className={cn('w-full rounded-xl transition-all duration-700 relative', i % 2 === 0 ? 'bg-rose-500/80' : 'bg-blue-500/80')}
                        style={{ height: `${Math.max(pct, 4)}%` }}
                        title={fmt(d.total_amount)}
                      />
                    </div>
                    <span className="text-[9px] font-black text-muted-foreground">{dayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day-by-day table */}
          <div className="space-y-2">
            {data.map((d) => (
              <div key={d.date} className="flex items-center justify-between p-3 rounded-xl border border-border/10 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground">
                      {formatDateWithWeekday(d.date)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{d.transfer_count} transferencia{d.transfer_count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <p className="text-sm font-black text-foreground">{fmt(d.total_amount)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

/* -----------------------------------------------------------------
   4. SOPORTE
----------------------------------------------------------------- */
interface SoporteModalProps {
  open: boolean;
  onClose: () => void;
  onContactAdmin: () => void;
  userName?: string;
  userRole?: string;
  onRequestTopup?: () => void;
  onReportError?: () => void;
  onCheckOrder?: () => void;
}

const mockMessages = [
  { id: 1, from: 'admin', text: 'Bienvenido al canal de soporte. ¿En qué podemos ayudarte?', time: '09:00' },
  { id: 2, from: 'admin', text: 'Recuerda que puedes solicitar recargas de saldo directamente desde este panel.', time: '09:01' },
  { id: 3, from: 'admin', text: '¿Necesitas ayuda con alguna transferencia pendiente?', time: '10:25' },
];

export function SoporteModal({ 
  open, 
  onClose, 
  onContactAdmin, 
  userName, 
  userRole,
  onRequestTopup,
  onReportError,
  onCheckOrder,
}: SoporteModalProps) {
  const firstName = userName?.split(' ')[0] || 'Usuario';
  const isGestor = userRole === 'gestor';

  const gestorActions = [
    { 
      label: 'Solicitar recarga de saldo', 
      icon: TrendingUp, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10 border-blue-500/20', 
      action: onRequestTopup || onContactAdmin 
    },
    { 
      label: 'Reportar transferencia con error', 
      icon: XCircle, 
      color: 'text-rose-500', 
      bg: 'bg-rose-500/10 border-rose-500/20', 
      action: onReportError || onContactAdmin 
    },
    { 
      label: 'Consultar estado de pedido', 
      icon: Clock, 
      color: 'text-amber-500', 
      bg: 'bg-amber-500/10 border-amber-500/20', 
      action: onCheckOrder || onContactAdmin 
    },
  ];

  const adminActions = [
    { label: 'Ver Tickets Abiertos', icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20', action: onContactAdmin },
    { label: 'Solicitar recarga de saldo', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', action: onContactAdmin },
  ];

  const actions = isGestor ? gestorActions : adminActions;

  return (
    <Drawer open={open} onClose={onClose} title="Centro de Soporte" subtitle="Comunicación con administración" icon={MessageSquare}>
      {/* Info Banner */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1">
        <p className="text-xs font-black text-foreground">📋 Hola {firstName}, estamos aquí para ayudarte</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {isGestor 
            ? "Usa este canal para reportar problemas con transferencias, solicitar recargas de saldo, o consultar el estado de tus pedidos."
            : "Usa este canal para reportar problemas con transferencias, solicitar recargas de saldo, o cualquier consulta al equipo de administración."}
        </p>
      </div>

      {/* Mock Chat Messages */}
      <div className="space-y-3">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Mensajes recientes</p>
        {mockMessages.map((msg) => (
          <div key={msg.id} className="flex flex-col items-start gap-1">
            <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-tl-none max-w-[85%]">
              <p className="text-sm font-bold text-foreground">{msg.text}</p>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase pl-1">Admin · {msg.time}</span>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Acciones rápidas</p>
        <div className="grid grid-cols-1 gap-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={a.action}
                className={cn('flex items-center gap-3 p-3.5 rounded-2xl border text-left hover:opacity-80 transition-all', a.bg)}
              >
                <Icon className={cn('h-4 w-4 shrink-0', a.color)} />
                <span className="text-sm font-bold text-foreground">{a.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={onContactAdmin}
        className="w-full h-12 rounded-xl bg-brand-gradient text-white font-black shadow-lg shadow-pink-500/20 hover:opacity-90 transition-all"
      >
        <MessageSquare className="h-4 w-4 mr-2" /> Abrir Ticket de Soporte
      </Button>
    </Drawer>
  );
}

/* -----------------------------------------------------------------
   5. COMISIONES - Admin vs Gestor
----------------------------------------------------------------- */
interface ComisionesModalProps {
  open: boolean;
  onClose: () => void;
  userRole?: string;
  stats: DashboardStats | null;
  commissionStats: AgentsCommissionStats | null;
  preferredCurrency: string;
}

export function ComisionesModal({ open, onClose, userRole, stats, commissionStats, preferredCurrency }: ComisionesModalProps) {
  const fmt = (n: number) => formatCurrency(convertCurrency(n, 'XAF', preferredCurrency), preferredCurrency);

  const isAdmin = isAdminRole(userRole);

  return (
    <Drawer open={open} onClose={onClose} title="Comisiones" subtitle={isAdmin ? 'Resumen de todos los gestores' : 'Tus ganancias por envíos'} icon={TrendingUp}>
      {isAdmin ? (
        <>
          {/* Admin: Ver todos los agentes con sus comisiones */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
              <p className="text-[10px] font-black uppercase text-green-500">Total Comisión</p>
              <p className="text-xl font-black text-foreground">{fmt(commissionStats?.totalCommission || 0)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] font-black uppercase text-emerald-500">Hoy</p>
              <p className="text-xl font-black text-foreground">{fmt(commissionStats?.todayCommission || 0)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20">
              <p className="text-[10px] font-black uppercase text-sky-500">Mes actual</p>
              <p className="text-xl font-black text-foreground">{fmt(commissionStats?.monthCommission || 0)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <p className="text-[10px] font-black uppercase text-violet-500">Anual</p>
              <p className="text-xl font-black text-foreground">{fmt(commissionStats?.yearCommission || 0)}</p>
            </div>
          </div>

          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide mb-2">Comisiones por gestor</p>
           <div className="space-y-2 max-h-[60vh] overflow-y-auto">
             {(commissionStats?.agents || []).map((agent) => (
               <div key={agent.agent_id} className="flex items-center justify-between p-3 rounded-xl border border-border/10 hover:bg-muted/30">
                 <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-bold">
                     {getInitials(agent.agent_name)}
                   </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{agent.agent_name}</p>
                    <p className="text-[10px] text-muted-foreground">{agent.transfer_count} envíos</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-green-600">{fmt(agent.total_commission)}</p>
                  <p className="text-[10px] text-muted-foreground">hoy: {fmt(agent.today_commission)}</p>
                  <p className="text-[10px] text-muted-foreground">mes: {fmt(agent.month_commission)} | anual: {fmt(agent.year_commission)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Gestor: Sus propias comisiones */}
          <div className="grid grid-cols-1 gap-3">
            <div className="p-5 rounded-2xl bg-green-500/10 border border-green-500/20">
              <p className="text-[10px] font-black uppercase text-green-500">Mi Comisión Total</p>
              <p className="text-3xl font-black text-foreground">{fmt(stats?.totalCommission || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Ganancias acumuladas por todos tus envíos</p>
            </div>
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] font-black uppercase text-emerald-500">Comisión Hoy</p>
              <p className="text-2xl font-black text-foreground">{fmt(stats?.todayCommission || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Ganado el día de hoy</p>
            </div>
            <div className="p-5 rounded-2xl bg-sky-500/10 border border-sky-500/20">
              <p className="text-[10px] font-black uppercase text-sky-500">Mes actual</p>
              <p className="text-2xl font-black text-foreground">{fmt(stats?.monthlyCommission || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">ComisiÃ³n acumulada del mes en curso</p>
            </div>
            <div className="p-5 rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <p className="text-[10px] font-black uppercase text-violet-500">Anual</p>
              <p className="text-2xl font-black text-foreground">{fmt(stats?.yearlyCommission || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Comision acumulada del ano en curso</p>
            </div>
            <div className="p-5 rounded-2xl bg-teal-500/10 border border-teal-500/20">
              <p className="text-[10px] font-black uppercase text-teal-500">Promedio por Envío</p>
              <p className="text-2xl font-black text-foreground">{fmt(stats?.commissionPerTransfer || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Comisión media por transacción</p>
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
