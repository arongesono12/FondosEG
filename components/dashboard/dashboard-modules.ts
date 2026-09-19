import type { UserRole } from '@/types';

export type DashboardModuleId =
  | 'transfers'
  | 'agents'
  | 'balance'
  | 'stats'
  | 'history'
  | 'staff';

export interface DashboardModuleViewProps {
  presentation?: 'page' | 'panel';
}

export interface DashboardModuleDefinition {
  id: DashboardModuleId;
  href: string;
  label: string;
  roles: readonly UserRole[];
}

export const DASHBOARD_MODULES: Record<DashboardModuleId, DashboardModuleDefinition> = {
  transfers: {
    id: 'transfers',
    href: '/transfers',
    label: 'Envíos',
    roles: ['cliente', 'gestor', 'admin', 'superadmin'],
  },
  agents: {
    id: 'agents',
    href: '/agents',
    label: 'Gestores',
    roles: ['admin', 'superadmin'],
  },
  balance: {
    id: 'balance',
    href: '/balance',
    label: 'Saldos',
    roles: ['cliente', 'gestor', 'admin', 'superadmin'],
  },
  stats: {
    id: 'stats',
    href: '/stats',
    label: 'Estadísticas',
    roles: ['admin', 'superadmin'],
  },
  history: {
    id: 'history',
    href: '/history',
    label: 'Historial',
    roles: ['cliente', 'gestor', 'admin', 'superadmin'],
  },
  staff: {
    id: 'staff',
    href: '/staff',
    label: 'Administración',
    roles: ['superadmin'],
  },
};

const moduleIds = Object.keys(DASHBOARD_MODULES) as DashboardModuleId[];

export function parseDashboardModule(value: string | null): DashboardModuleId | null {
  return value && moduleIds.includes(value as DashboardModuleId)
    ? (value as DashboardModuleId)
    : null;
}

export function getDashboardModuleFromPath(path: string): DashboardModuleId | null {
  return moduleIds.find((id) => DASHBOARD_MODULES[id].href === path) ?? null;
}

export function getDashboardModuleHref(moduleId: DashboardModuleId): string {
  return `/dashboard?module=${encodeURIComponent(moduleId)}`;
}

export function getDashboardNavigationHref(path: string): string {
  const moduleId = getDashboardModuleFromPath(path);
  return moduleId ? getDashboardModuleHref(moduleId) : path;
}

export function canAccessDashboardModule(
  moduleId: DashboardModuleId,
  role?: UserRole | null,
): boolean {
  return Boolean(role && DASHBOARD_MODULES[moduleId].roles.includes(role));
}
