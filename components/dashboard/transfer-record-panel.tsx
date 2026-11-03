'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Receipt } from '@/components/ui/hugeicons';
import {
  RecordAvatar,
  RecordDetailAction,
  RecordDetailEmpty,
  RecordDetailFooter,
  RecordDetailHeading,
  RecordDetailTiles,
  RecordListEmpty,
  RecordPanel,
  RecordTileAction,
} from '@/components/dashboard/record-panel';
import { isTransferCompleted, isTransferPending } from '@/lib/financial';
import { buildRecordTabs, filterByRecordTab, type RecordTab, type RecordTabDefinition } from '@/lib/record-tabs';
import { formatDate, formatDateShort } from '@/lib/utils';
import type { Transfer } from '@/types';

export const transferStatusLabels: Record<Transfer['status'], string> = {
  created: 'Pendiente', available_for_pickup: 'Disponible', paid_out: 'Pagada', completed: 'Completada', cancelled: 'Cancelada',
};

export const transferTabDefinitions: readonly RecordTabDefinition<Transfer>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'completed', label: 'Completadas', matches: (transfer) => isTransferCompleted(transfer.status) },
  { value: 'pending', label: 'Pendientes', matches: (transfer) => isTransferPending(transfer.status) },
];

export function TransferHistoryLink() {
  return (
    <Link href="/history" className="overview-history-link" aria-label="Ver historial completo">
      <Receipt />
      <ArrowUpRight />
    </Link>
  );
}

export function TransferHistoryAction() {
  return <RecordDetailAction href="/history">Ver en historial<ArrowUpRight /></RecordDetailAction>;
}

interface TransferRecordPanelProps {
  label: string;
  title: string;
  subtitle?: ReactNode;
  transfers: readonly Transfer[];
  format: (amount: number, currency: string) => string;
  tabs?: readonly RecordTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  corner?: ReactNode;
  cornerRow?: 'phone' | 'laptop';
  emptyList: ReactNode;
  emptyDetail: ReactNode;
  listFooter?: ReactNode;
  tileAction?: (transfer: Transfer) => ReactNode;
  footerAction?: (transfer: Transfer) => ReactNode;
  /** Para el historial: añade hora, país de destino y gestor. */
  detailed?: boolean;
}

export function TransferRecordPanel({ transfers, format, tileAction, footerAction, detailed, ...panel }: TransferRecordPanelProps) {
  const renderDetail = (transfer: Transfer) => {
    const amount = format(transfer.amount, transfer.currency);
    const status = transferStatusLabels[transfer.status];
    const typeLabel = transfer.transfer_type === 'client' ? 'Entre clientes' : 'Envío de gestor';
    const destination = detailed
      ? [transfer.destination_city, transfer.destination_country].filter(Boolean).join(', ')
      : transfer.destination_city;

    return (
      <>
        <RecordDetailHeading
          label="Detalle de la operación"
          title={`#${transfer.transfer_code}`}
          badge={status}
          columns={[
            { label: 'Remitente', primary: transfer.sender_name, secondary: transfer.sender_phone },
            { label: 'Destinatario', primary: transfer.receiver_name, secondary: destination, avatar: <RecordAvatar name={transfer.receiver_name} /> },
          ]}
        />
        <RecordDetailTiles
          tiles={[
            { icon: <ArrowUpRight />, value: amount, label: 'Importe del envío' },
            { icon: <ArrowUpRight />, value: typeof transfer.commission_amount === 'number' ? format(transfer.commission_amount, transfer.currency) : '—', label: 'Comisión' },
            {
              icon: <CalendarDays />,
              value: detailed ? formatDate(transfer.created_at) : formatDateShort(transfer.created_at),
              label: detailed && transfer.agent?.name ? `Gestor ${transfer.agent.name}` : typeLabel,
            },
          ]}
          action={tileAction?.(transfer)}
        />
        {transfer.notes && <p className="overview-transfer-notes">{transfer.notes}</p>}
        <RecordDetailFooter
          items={[
            { label: 'Importe', value: amount },
            { label: 'Destino', value: transfer.destination_city || '—' },
            { label: 'Estado', value: status },
          ]}
          actions={footerAction?.(transfer)}
        />
      </>
    );
  };

  return (
    <RecordPanel
      {...panel}
      tabsLabel="Mostrar operaciones"
      listLabel="Seleccionar una operación"
      items={transfers}
      getId={(transfer) => transfer.id}
      renderRow={(transfer) => ({
        avatar: <RecordAvatar name={transfer.receiver_name || transfer.sender_name} />,
        title: `#${transfer.transfer_code}`,
        subtitle: formatDateShort(transfer.created_at),
        state: transferStatusLabels[transfer.status],
        value: format(transfer.amount, transfer.currency),
      })}
      renderDetail={renderDetail}
    />
  );
}

interface RecentTransfersPanelProps {
  title: string;
  transfers: readonly Transfer[];
  format: (amount: number, currency: string) => string;
  emptyMessage: string;
  /** Destino del mosaico «Nuevo envío»; sin él, el rol no puede crear envíos desde aquí. */
  newTransfer?: { href?: string; onSelect?: () => void };
}

/** Últimas operaciones de un módulo, con las mismas pestañas locales que el dashboard principal. */
export function RecentTransfersPanel({ title, transfers, format, emptyMessage, newTransfer }: RecentTransfersPanelProps) {
  const [tab, setTab] = useState('all');
  const visible = filterByRecordTab(transfers, transferTabDefinitions, tab);

  return (
    <TransferRecordPanel
      label={title}
      title={title}
      subtitle={`Operaciones recientes: ${transfers.length}`}
      transfers={visible}
      format={format}
      tabs={buildRecordTabs(transfers, transferTabDefinitions)}
      activeTab={tab}
      onTabChange={setTab}
      corner={<TransferHistoryLink />}
      emptyList={<RecordListEmpty><p>{transfers.length ? 'No hay operaciones en esta pestaña.' : emptyMessage}</p></RecordListEmpty>}
      emptyDetail={transfers.length
        ? <RecordDetailEmpty title="Sin resultados" description="Cambia de pestaña para consultar una operación." />
        : <RecordDetailEmpty title="Cada envío, al detalle" description="Aquí aparecerán el importe, el destinatario y el estado de tus operaciones." />}
      tileAction={newTransfer ? () => <RecordTileAction label="Nuevo envío" {...newTransfer} /> : undefined}
      footerAction={() => <TransferHistoryAction />}
    />
  );
}
