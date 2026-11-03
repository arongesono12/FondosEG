'use client';

import { useState } from 'react';
import { ExpandableSearch } from '@/components/dashboard/expandable-search';
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
import { ArrowUpRight, Banknote, CalendarDays, CreditCard, Landmark, RotateCcw, Wallet } from '@/components/ui/hugeicons';
import { LOW_FLOAT_THRESHOLD } from '@/lib/financial';
import { buildRecordTabs, filterByRecordTab, type RecordTabDefinition } from '@/lib/record-tabs';
import { getRoleLabel } from '@/lib/roles';
import { formatCurrency, formatDate, formatDateShort } from '@/lib/utils';
import type { AgentWithBalance } from '@/types';

const isLowFloat = (agent: AgentWithBalance) => Number(agent.balance || 0) < LOW_FLOAT_THRESHOLD;
const statusLabel = (agent: AgentWithBalance) => (agent.is_active ? 'Activo' : 'Inactivo');

const agentTabDefinitions: readonly RecordTabDefinition<AgentWithBalance>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos', matches: (agent) => agent.is_active },
  { value: 'inactive', label: 'Inactivos', matches: (agent) => !agent.is_active },
];

const availabilityTabDefinitions: readonly RecordTabDefinition<AgentWithBalance>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos', matches: (agent) => agent.is_active },
  { value: 'low', label: 'Bajo float', matches: isLowFloat },
];

interface AgentsRecordPanelProps {
  agents: readonly AgentWithBalance[];
  onToggleStatus: (agent: AgentWithBalance) => void;
  onResetBalance: (agent: AgentWithBalance) => void;
  onTopUp: (agent: AgentWithBalance) => void;
}

export function AgentsRecordPanel({ agents, onToggleStatus, onResetBalance, onTopUp }: AgentsRecordPanelProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const needle = search.toLowerCase();
  const found = agents.filter((agent) =>
    agent.name.toLowerCase().includes(needle) ||
    agent.email.toLowerCase().includes(needle) ||
    agent.phone.includes(search)
  );

  return (
    <RecordPanel
      label="Gestores de la red"
      title="Gestores de la red"
      subtitle={`Gestores registrados: ${agents.length}`}
      tabs={buildRecordTabs(found, agentTabDefinitions)}
      activeTab={tab}
      onTabChange={setTab}
      tabsLabel="Mostrar gestores"
      corner={<ExpandableSearch value={search} onChange={setSearch} label="Buscar gestores" placeholder="Nombre, correo o teléfono" />}
      cornerRow="phone"
      listLabel="Seleccionar un gestor"
      items={filterByRecordTab(found, agentTabDefinitions, tab)}
      getId={(agent) => agent.id}
      renderRow={(agent) => ({
        avatar: <RecordAvatar name={agent.name} src={agent.avatar_url} />,
        title: agent.name,
        subtitle: agent.phone,
        state: statusLabel(agent),
        value: formatCurrency(agent.balance),
      })}
      renderDetail={(agent) => (
        <>
          <RecordDetailHeading
            label="Detalle del gestor"
            title={agent.name}
            badge={statusLabel(agent)}
            columns={[
              { label: 'Correo', primary: agent.email },
              { label: 'Teléfono', primary: agent.phone },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <Wallet />, value: formatCurrency(agent.balance), label: 'Saldo' },
              { icon: <Banknote />, value: formatCurrency(agent.cash_balance || 0), label: 'Efectivo' },
              { icon: <CalendarDays />, value: formatDateShort(agent.created_at), label: 'Registro' },
            ]}
            action={<RecordTileAction label="Recargar" icon={<CreditCard />} onSelect={() => onTopUp(agent)} />}
          />
          <RecordDetailFooter
            items={[
              { label: 'Estado', value: statusLabel(agent) },
              { label: 'Rol', value: getRoleLabel(agent.role) },
              { label: 'Float', value: isLowFloat(agent) ? 'Bajo umbral' : 'Correcto' },
            ]}
            actions={(
              <>
                <RecordDetailAction secondary onSelect={() => onResetBalance(agent)}><RotateCcw />Restablecer saldo</RecordDetailAction>
                <RecordDetailAction
                  label={agent.is_active ? `Desactivar a ${agent.name}` : `Activar a ${agent.name}`}
                  onSelect={() => onToggleStatus(agent)}
                >
                  {agent.is_active ? 'Desactivar' : 'Activar'}
                </RecordDetailAction>
              </>
            )}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>No se encontraron gestores</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Sin gestores" description="Ajusta la búsqueda o crea un gestor para consultar su saldo y su contacto." />}
    />
  );
}

interface AgentAvailabilityPanelProps {
  agents: readonly AgentWithBalance[];
  onTopUp: (agent: AgentWithBalance) => void;
}

export function AgentAvailabilityPanel({ agents, onTopUp }: AgentAvailabilityPanelProps) {
  const [tab, setTab] = useState('all');

  return (
    <RecordPanel
      label="Disponibilidad por gestor"
      title="Disponibilidad por gestor"
      subtitle={`Gestores en la red: ${agents.length}`}
      tabs={buildRecordTabs(agents, availabilityTabDefinitions)}
      activeTab={tab}
      onTabChange={setTab}
      tabsLabel="Mostrar gestores"
      listLabel="Seleccionar un gestor"
      items={filterByRecordTab(agents, availabilityTabDefinitions, tab)}
      getId={(agent) => agent.id}
      renderRow={(agent) => ({
        avatar: <RecordAvatar name={agent.name} src={agent.avatar_url} />,
        title: agent.name,
        subtitle: agent.phone,
        state: isLowFloat(agent) ? 'Bajo float' : statusLabel(agent),
        value: formatCurrency(agent.balance),
      })}
      renderDetail={(agent) => (
        <>
          <RecordDetailHeading
            label="Disponibilidad del gestor"
            title={agent.name}
            badge={isLowFloat(agent) ? `${statusLabel(agent)} · Bajo float` : statusLabel(agent)}
            columns={[
              { label: 'Correo', primary: agent.email },
              { label: 'Teléfono', primary: agent.phone },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <Wallet />, value: formatCurrency(agent.balance), label: 'Float' },
              { icon: <Banknote />, value: formatCurrency(agent.cash_balance || 0), label: 'Efectivo' },
              { icon: <Landmark />, value: formatCurrency(agent.topup_total || 0), label: 'Total recargado' },
            ]}
            action={<RecordTileAction label="Recargar" icon={<CreditCard />} onSelect={() => onTopUp(agent)} />}
          />
          <RecordDetailFooter
            items={[
              { label: 'Float', value: formatCurrency(agent.balance) },
              { label: 'Estado', value: statusLabel(agent) },
              { label: 'Última recarga', value: agent.last_topup_at ? formatDate(agent.last_topup_at) : '—' },
            ]}
            actions={<RecordDetailAction href="/agents">Ver gestores<ArrowUpRight /></RecordDetailAction>}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>No hay gestores en esta pestaña.</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Sin gestores" description="Aquí aparecerán el float, el efectivo y las recargas de cada gestor." />}
    />
  );
}
