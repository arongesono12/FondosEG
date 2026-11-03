'use client';

import { useState } from 'react';
import {
  RecordDetailAction,
  RecordDetailEmpty,
  RecordDetailFooter,
  RecordDetailHeading,
  RecordDetailTiles,
  RecordListEmpty,
  RecordPanel,
  RecordTileAction,
} from '@/components/dashboard/record-panel';
import { ArrowUpRight, Banknote, CalendarDays, Clock, Landmark, Plus, Receipt, Wallet } from '@/components/ui/hugeicons';
import { shareOf } from '@/lib/dashboard-series';
import { getWithdrawalStatusLabel } from '@/lib/financial';
import { buildRecordTabs, filterByRecordTab, type RecordTabDefinition } from '@/lib/record-tabs';
import { formatCurrency, formatDate, formatDateShort } from '@/lib/utils';
import type { BalanceTransaction, ClientWithdrawal } from '@/types';

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

const isIncoming = (transaction: BalanceTransaction) => transaction.amount >= 0;
const signedAmount = (transaction: BalanceTransaction) => `${isIncoming(transaction) ? '+' : ''}${formatCurrency(transaction.amount)}`;

const movementTabDefinitions: readonly RecordTabDefinition<BalanceTransaction>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'in', label: 'Entradas', matches: isIncoming },
  { value: 'out', label: 'Salidas', matches: (transaction) => !isIncoming(transaction) },
];

export function AccountMovementsPanel({ transactions }: { transactions: readonly BalanceTransaction[] }) {
  const [tab, setTab] = useState('all');

  return (
    <RecordPanel
      label="Movimientos de cuenta"
      title="Movimientos de cuenta"
      subtitle={`Movimientos recientes: ${transactions.length}`}
      tabs={buildRecordTabs(transactions, movementTabDefinitions)}
      activeTab={tab}
      onTabChange={setTab}
      tabsLabel="Mostrar movimientos"
      listLabel="Seleccionar un movimiento"
      items={filterByRecordTab(transactions, movementTabDefinitions, tab)}
      getId={(transaction) => transaction.id}
      renderRow={(transaction) => ({
        avatar: <span className="overview-person-avatar">{isIncoming(transaction) ? '+' : '−'}</span>,
        title: transactionTypeLabel(transaction.type),
        subtitle: formatDateShort(transaction.created_at),
        value: signedAmount(transaction),
      })}
      renderDetail={(transaction) => (
        <>
          <RecordDetailHeading
            label="Detalle del movimiento"
            title={transactionTypeLabel(transaction.type)}
            badge={isIncoming(transaction) ? 'Entrada' : 'Salida'}
            columns={[
              { label: 'Descripción', primary: transaction.description || 'Sin descripción' },
              { label: 'Fecha', primary: formatDate(transaction.created_at) },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <ArrowUpRight />, value: signedAmount(transaction), label: 'Monto' },
              { icon: <Wallet />, value: formatCurrency(transaction.previous_balance), label: 'Saldo anterior' },
              { icon: <Landmark />, value: formatCurrency(transaction.new_balance), label: 'Saldo resultante' },
            ]}
          />
          <RecordDetailFooter
            items={[
              { label: 'Monto', value: signedAmount(transaction) },
              { label: 'Operación', value: transactionTypeLabel(transaction.type) },
              { label: 'Saldo resultante', value: formatCurrency(transaction.new_balance) },
            ]}
            actions={<RecordDetailAction href="/history">Ver historial<ArrowUpRight /></RecordDetailAction>}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>{transactions.length ? 'No hay movimientos en esta pestaña.' : 'Sin movimientos registrados todavía.'}</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Cada movimiento, al detalle" description="Aquí aparecerán el monto y el saldo resultante de cada movimiento de caja." />}
    />
  );
}

export interface CurrencySnapshot {
  currency: string;
  available: number;
  reserved: number;
  gross: number;
}

interface CurrencyBalancesPanelProps {
  snapshots: readonly CurrencySnapshot[];
  onGenerateCode: () => void;
}

export function CurrencyBalancesPanel({ snapshots, onGenerateCode }: CurrencyBalancesPanelProps) {
  return (
    <RecordPanel
      label="Saldos por moneda"
      title="Saldos por moneda"
      subtitle={`Monedas activas: ${snapshots.length}`}
      listLabel="Seleccionar una moneda"
      items={snapshots}
      getId={(snapshot) => snapshot.currency}
      renderRow={(snapshot) => ({
        avatar: <span className="overview-person-avatar"><Wallet /></span>,
        title: snapshot.currency,
        subtitle: `Reservado ${formatCurrency(snapshot.reserved, snapshot.currency)}`,
        value: formatCurrency(snapshot.available, snapshot.currency),
      })}
      renderDetail={(snapshot) => (
        <>
          <RecordDetailHeading
            label="Saldo disponible"
            title={formatCurrency(snapshot.available, snapshot.currency)}
            badge={snapshot.currency}
            columns={[
              { label: 'Reservado', primary: formatCurrency(snapshot.reserved, snapshot.currency), secondary: 'Códigos de retiro y órdenes pendientes' },
              { label: 'Retenido', primary: `${shareOf(snapshot.reserved, snapshot.gross)} %`, secondary: 'Del total bruto' },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <Wallet />, value: formatCurrency(snapshot.available, snapshot.currency), label: 'Disponible' },
              { icon: <Clock />, value: formatCurrency(snapshot.reserved, snapshot.currency), label: 'Reservado' },
              { icon: <Landmark />, value: formatCurrency(snapshot.gross, snapshot.currency), label: 'Total bruto' },
            ]}
            action={<RecordTileAction label="Generar código" icon={<Banknote />} onSelect={onGenerateCode} />}
          />
          <RecordDetailFooter
            items={[
              { label: 'Moneda', value: snapshot.currency },
              { label: 'Disponible', value: formatCurrency(snapshot.available, snapshot.currency) },
            ]}
            actions={<RecordDetailAction href="/transfers">Ir a envíos<ArrowUpRight /></RecordDetailAction>}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>Todavía no tienes saldos abiertos.</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Tus saldos, por moneda" description="Aquí aparecerán el disponible, lo reservado y el total de cada moneda." />}
    />
  );
}

const withdrawalTabDefinitions: readonly RecordTabDefinition<ClientWithdrawal>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Disponibles', matches: (withdrawal) => withdrawal.status === 'pending' },
  { value: 'paid', label: 'Retirados', matches: (withdrawal) => withdrawal.status === 'paid_out' },
];

interface WithdrawalsPanelProps {
  withdrawals: readonly ClientWithdrawal[];
  onGenerateCode: () => void;
}

export function WithdrawalsPanel({ withdrawals, onGenerateCode }: WithdrawalsPanelProps) {
  const [tab, setTab] = useState('all');

  return (
    <RecordPanel
      label="Retiros en efectivo"
      title="Retiros en efectivo"
      subtitle={`Retiros recientes: ${withdrawals.length}`}
      tabs={buildRecordTabs(withdrawals, withdrawalTabDefinitions)}
      activeTab={tab}
      onTabChange={setTab}
      tabsLabel="Mostrar retiros"
      corner={(
        <button type="button" className="overview-history-link" onClick={onGenerateCode}>
          <Plus />
          <span>Generar código</span>
        </button>
      )}
      listLabel="Seleccionar un retiro"
      items={filterByRecordTab(withdrawals, withdrawalTabDefinitions, tab)}
      getId={(withdrawal) => withdrawal.id}
      renderRow={(withdrawal) => ({
        avatar: <span className="overview-person-avatar"><Banknote /></span>,
        title: withdrawal.withdrawal_code,
        subtitle: formatDateShort(withdrawal.created_at),
        state: getWithdrawalStatusLabel(withdrawal.status),
        value: formatCurrency(Number(withdrawal.amount), withdrawal.currency),
      })}
      renderDetail={(withdrawal) => {
        const amount = formatCurrency(Number(withdrawal.amount), withdrawal.currency);
        const held = withdrawal.status === 'pending' && withdrawal.expires_at;
        return (
          <>
            <RecordDetailHeading
              label="Detalle del retiro"
              title={withdrawal.withdrawal_code}
              badge={getWithdrawalStatusLabel(withdrawal.status)}
              columns={[
                { label: 'Destino', primary: withdrawal.destination_city || '—' },
                { label: 'Creado', primary: formatDate(withdrawal.created_at) },
              ]}
            />
            <RecordDetailTiles
              tiles={[
                { icon: <ArrowUpRight />, value: amount, label: 'Importe' },
                { icon: <CalendarDays />, value: formatDateShort(withdrawal.created_at), label: 'Fecha' },
                { icon: <Receipt />, value: withdrawal.currency, label: 'Moneda' },
              ]}
              action={<RecordTileAction label="Generar código" onSelect={onGenerateCode} />}
            />
            {held && <p className="overview-transfer-notes">Retenido hasta {formatDate(held)}</p>}
            <RecordDetailFooter
              items={[
                { label: 'Importe', value: amount },
                { label: 'Destino', value: withdrawal.destination_city || '—' },
                { label: 'Estado', value: getWithdrawalStatusLabel(withdrawal.status) },
              ]}
            />
          </>
        );
      }}
      emptyList={<RecordListEmpty><p>{withdrawals.length ? 'No hay retiros en esta pestaña.' : 'Todavía no has generado códigos de retiro.'}</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Tu efectivo, cuando lo quieras" description="Tus fondos son tuyos desde que entran. Genera un código cuando quieras cobrarlos en efectivo." />}
    />
  );
}
