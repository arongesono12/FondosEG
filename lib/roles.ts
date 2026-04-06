import type { UserRole } from '@/types';

export const ADMIN_ROLES: UserRole[] = ['admin', 'superadmin'];
export const STAFF_ROLES: UserRole[] = ['gestor', ...ADMIN_ROLES];

export function isAdminRole(role?: string | null): role is 'admin' | 'superadmin' {
  return role === 'admin' || role === 'superadmin';
}

export function isSuperAdminRole(role?: string | null): role is 'superadmin' {
  return role === 'superadmin';
}

export function getRoleLabel(role?: string | null): string {
  switch (role) {
    case 'superadmin':
      return 'Super administrador';
    case 'admin':
      return 'Administrador';
    case 'gestor':
      return 'Gestor';
    case 'cliente':
      return 'Cliente';
    default:
      return role || 'Usuario';
  }
}
