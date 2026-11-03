'use client';

import {
  RecordAvatar,
  RecordDetailEmpty,
  RecordDetailFooter,
  RecordDetailHeading,
  RecordDetailTiles,
  RecordListEmpty,
  RecordPanel,
} from '@/components/dashboard/record-panel';
import { ArrowUpRight, CalendarDays, Clock, Landmark, RotateCcw, Send, TrendingUp, Wallet } from '@/components/ui/hugeicons';
import type { AgentCommissionStat, ReconciliationPeriodSummary } from '@/types';

interface CommissionsPanelProps {
  agents: readonly AgentCommissionStat[];
  monthCommission: number;
  yearCommission: number;
  format: (amount: number) => string;
}

export function CommissionsPanel({ agents, monthCommission, yearCommission, format }: CommissionsPanelProps) {
  return (
    <RecordPanel
      label="Comisiones por gestor"
      title="Comisiones por gestor"
      subtitle={`Mes actual ${format(monthCommission)} · Año actual ${format(yearCommission)}`}
      listLabel="Seleccionar un gestor"
      items={agents}
      getId={(agent) => agent.agent_id}
      renderRow={(agent) => ({
        avatar: <RecordAvatar name={agent.agent_name} />,
        title: agent.agent_name,
        subtitle: `${agent.transfer_count} operaciones`,
        value: format(agent.net_profit),
      })}
      renderDetail={(agent) => (
        <>
          <RecordDetailHeading
            label="Comisiones del gestor"
            title={agent.agent_name}
            badge={`${agent.transfer_count} operaciones`}
            columns={[
              { label: 'Neto estimado', primary: format(agent.net_profit) },
              { label: 'Margen', primary: `${agent.net_margin} %`, secondary: `Costo est. ${format(agent.estimated_cost)}` },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <Clock />, value: format(agent.today_commission), label: 'Hoy' },
              { icon: <CalendarDays />, value: format(agent.month_commission), label: 'Mes' },
              { icon: <TrendingUp />, value: format(agent.year_commission), label: 'Año' },
              { icon: <Landmark />, value: format(agent.total_commission), label: 'Acumulado' },
            ]}
          />
          <RecordDetailFooter
            items={[
              { label: 'Neto estimado', value: format(agent.net_profit) },
              { label: 'Costo estimado', value: format(agent.estimated_cost) },
              { label: 'Margen', value: `${agent.net_margin} %` },
            ]}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>No hay datos de comisión todavía.</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Comisiones, gestor a gestor" description="Aquí aparecerán el neto, el margen y las comisiones de cada gestor." />}
    />
  );
}

interface ReconciliationPanelProps {
  periods: readonly ReconciliationPeriodSummary[];
  /** Sin total, la conciliación no llegó a cargarse. */
  totalNetFlow?: number;
  formatPeriod: (period: string) => string;
  format: (amount: number) => string;
}

export function ReconciliationPanel({ periods, totalNetFlow, formatPeriod, format }: ReconciliationPanelProps) {
  return (
    <RecordPanel
      label="Conciliación mensual"
      title="Conciliación mensual"
      subtitle={totalNetFlow === undefined ? undefined : `Neto del período ${format(totalNetFlow)}`}
      listLabel="Seleccionar un mes"
      items={periods}
      getId={(period) => period.period}
      renderRow={(period) => ({
        avatar: <span className="overview-person-avatar"><CalendarDays /></span>,
        title: formatPeriod(period.period),
        subtitle: `${period.transactionCount} movimientos`,
        value: format(period.netFlow),
      })}
      renderDetail={(period) => (
        <>
          <RecordDetailHeading
            label="Conciliación del mes"
            title={formatPeriod(period.period)}
            badge={`${period.transactionCount} movimientos`}
            columns={[
              { label: 'Flujo neto', primary: format(period.netFlow) },
              { label: 'Neto del período', primary: totalNetFlow === undefined ? '—' : format(totalNetFlow) },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <Wallet />, value: format(period.topups), label: 'Topups' },
              { icon: <Send />, value: format(period.transfersOutflow), label: 'Salidas' },
              { icon: <RotateCcw />, value: format(period.resets), label: 'Ajustes' },
              { icon: <ArrowUpRight />, value: format(period.refunds), label: 'Reembolsos' },
            ]}
          />
          <RecordDetailFooter
            items={[
              { label: 'Entradas', value: format(period.topups) },
              { label: 'Salidas', value: format(period.transfersOutflow) },
              { label: 'Flujo neto', value: format(period.netFlow) },
            ]}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>No hay movimientos suficientes para conciliar.</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Cada mes, conciliado" description="Aquí aparecerán las entradas, las salidas y el flujo neto de cada mes." />}
    />
  );
}
