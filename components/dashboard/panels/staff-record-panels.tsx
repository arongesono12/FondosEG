'use client';

import { useState } from 'react';
import { ExpandableSearch } from '@/components/dashboard/expandable-search';
import {
  RecordAvatar,
  RecordDetailAction,
  RecordDetailEmpty,
  RecordDetailFooter,
  RecordDetailHeading,
  RecordDetailNote,
  RecordDetailTiles,
  RecordListEmpty,
  RecordPanel,
} from '@/components/dashboard/record-panel';
import { CalendarDays, Clock, Eye, Receipt, Shield, ShieldCheck } from '@/components/ui/hugeicons';
import { buildRecordTabs, filterByRecordTab, type RecordTabDefinition } from '@/lib/record-tabs';
import { getRoleLabel } from '@/lib/roles';
import { formatDate, formatDateShort } from '@/lib/utils';
import type { ManagedDashboardUser, StaffActivityItem, StaffMember } from '@/services/staff';

const statusLabel = (member: { is_active: boolean }) => (member.is_active ? 'Activo' : 'Inactivo');

const teamTabDefinitions: readonly RecordTabDefinition<StaffMember>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos', matches: (member) => member.is_active },
  { value: 'inactive', label: 'Inactivos', matches: (member) => !member.is_active },
];

interface StaffTeamPanelProps {
  staff: readonly StaffMember[];
  onToggleStatus: (member: StaffMember) => void;
}

export function StaffTeamPanel({ staff, onToggleStatus }: StaffTeamPanelProps) {
  const [tab, setTab] = useState('all');

  return (
    <RecordPanel
      label="Equipo administrativo"
      title="Equipo administrativo"
      subtitle={`Cuentas de administración: ${staff.length}`}
      tabs={buildRecordTabs(staff, teamTabDefinitions)}
      activeTab={tab}
      onTabChange={setTab}
      tabsLabel="Mostrar administradores"
      listLabel="Seleccionar un administrador"
      items={filterByRecordTab(staff, teamTabDefinitions, tab)}
      getId={(member) => member.id}
      renderRow={(member) => ({
        avatar: <RecordAvatar name={member.name} />,
        title: member.name,
        subtitle: member.email,
        state: statusLabel(member),
        value: `${member.action_count} acciones`,
      })}
      renderDetail={(member) => (
        <>
          <RecordDetailHeading
            label="Detalle del administrador"
            title={member.name}
            badge={getRoleLabel(member.role)}
            columns={[
              { label: 'Contacto', primary: member.email, secondary: member.phone },
              { label: 'Última acción', primary: member.last_action || 'Sin actividad' },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <ShieldCheck />, value: member.action_count, label: 'Acciones' },
              { icon: <Clock />, value: member.last_action_at ? formatDateShort(member.last_action_at) : '—', label: 'Última actividad' },
              { icon: <CalendarDays />, value: formatDateShort(member.created_at), label: 'Alta' },
            ]}
          />
          <RecordDetailFooter
            items={[
              { label: 'Estado', value: statusLabel(member) },
              { label: 'Rol', value: getRoleLabel(member.role) },
            ]}
            actions={member.role === 'admin'
              ? <RecordDetailAction onSelect={() => onToggleStatus(member)}>{member.is_active ? 'Desactivar' : 'Activar'}</RecordDetailAction>
              : <RecordDetailNote>Protegido</RecordDetailNote>}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>{staff.length ? 'No hay administradores en esta pestaña.' : 'Todavía no hay administradores.'}</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Sin administradores" description="Aquí aparecerán el rol, la actividad y el estado de cada cuenta." />}
    />
  );
}

const userTabDefinitions: readonly RecordTabDefinition<ManagedDashboardUser>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'gestor', label: 'Gestores', matches: (member) => member.role === 'gestor' },
  { value: 'cliente', label: 'Clientes', matches: (member) => member.role === 'cliente' },
];

interface ManagedUsersPanelProps {
  users: readonly ManagedDashboardUser[];
  onOpenMovements: (member: ManagedDashboardUser) => void;
}

export function ManagedUsersPanel({ users, onOpenMovements }: ManagedUsersPanelProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const needle = search.trim().toLowerCase();
  const found = users.filter((member) =>
    !needle || [member.name, member.email, member.phone].filter(Boolean).some((value) => value.toLowerCase().includes(needle))
  );

  return (
    <RecordPanel
      label="Usuarios del dashboard"
      title="Usuarios del dashboard"
      subtitle="Agentes y clientes con su historial de movimientos"
      tabs={buildRecordTabs(found, userTabDefinitions)}
      activeTab={tab}
      onTabChange={setTab}
      tabsLabel="Filtrar por rol"
      corner={<ExpandableSearch value={search} onChange={setSearch} label="Buscar usuarios" placeholder="Nombre, email o teléfono" />}
      cornerRow="phone"
      listLabel="Seleccionar un usuario"
      items={filterByRecordTab(found, userTabDefinitions, tab)}
      getId={(member) => member.id}
      renderRow={(member) => ({
        avatar: <RecordAvatar name={member.name} />,
        title: member.name,
        subtitle: getRoleLabel(member.role),
        state: statusLabel(member),
        value: `${member.movement_count} mov.`,
      })}
      renderDetail={(member) => (
        <>
          <RecordDetailHeading
            label="Detalle del usuario"
            title={member.name}
            badge={getRoleLabel(member.role)}
            columns={[
              { label: 'Contacto', primary: member.email, secondary: member.phone },
              member.last_movement_at
                ? { label: 'Último movimiento', primary: member.last_movement_label || 'Movimiento reciente', secondary: formatDate(member.last_movement_at) }
                : { label: 'Último movimiento', primary: 'Sin movimientos registrados' },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <Receipt />, value: member.movement_count, label: 'Movimientos' },
              { icon: <Clock />, value: member.last_movement_at ? formatDateShort(member.last_movement_at) : '—', label: 'Último' },
              { icon: <CalendarDays />, value: formatDateShort(member.created_at), label: 'Alta' },
            ]}
          />
          <RecordDetailFooter
            items={[
              { label: 'Estado', value: statusLabel(member) },
              { label: 'Rol', value: getRoleLabel(member.role) },
            ]}
            actions={<RecordDetailAction onSelect={() => onOpenMovements(member)}><Eye />Ver movimientos</RecordDetailAction>}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>No hay usuarios que coincidan con el filtro actual.</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Sin usuarios" description="Ajusta la búsqueda o cambia de pestaña para consultar un usuario." />}
    />
  );
}

export function StaffActivityPanel({ activity }: { activity: readonly StaffActivityItem[] }) {
  return (
    <RecordPanel
      label="Bitácora del staff"
      title="Bitácora del staff"
      subtitle={`Acciones recientes: ${activity.length}`}
      listLabel="Seleccionar una acción"
      items={activity}
      getId={(item) => item.id}
      renderRow={(item) => ({
        avatar: <RecordAvatar name={item.actor_name} />,
        title: item.actor_name,
        subtitle: item.action,
        value: formatDateShort(item.created_at),
      })}
      renderDetail={(item) => (
        <>
          <RecordDetailHeading
            label="Detalle de la acción"
            title={item.actor_name}
            badge={getRoleLabel(item.actor_role)}
            columns={[
              { label: 'Acción', primary: item.action },
              { label: 'Fecha', primary: formatDate(item.created_at) },
            ]}
          />
          <RecordDetailTiles
            tiles={[
              { icon: <Shield />, value: getRoleLabel(item.actor_role), label: 'Rol' },
              { icon: <Receipt />, value: item.entity_type || '—', label: 'Entidad' },
              { icon: <CalendarDays />, value: formatDateShort(item.created_at), label: 'Fecha' },
            ]}
          />
          <RecordDetailFooter
            items={[
              { label: 'Autor', value: item.actor_name },
              { label: 'Rol', value: getRoleLabel(item.actor_role) },
            ]}
          />
        </>
      )}
      emptyList={<RecordListEmpty><p>Aún no hay acciones registradas por administradores.</p></RecordListEmpty>}
      emptyDetail={<RecordDetailEmpty title="Cada acción, registrada" description="Aquí aparecerán el autor, la acción y la fecha de lo que haga el staff." />}
    />
  );
}
