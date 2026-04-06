import { fetchJSON } from '@/services/http';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'superadmin';
  is_active: boolean;
  created_at: string;
  action_count: number;
  last_action_at?: string | null;
  last_action?: string | null;
}

export interface StaffActivityItem {
  id: string;
  user_id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  actor_name: string;
  actor_role: string;
}

export interface ManagedDashboardUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'gestor' | 'cliente';
  is_active: boolean;
  created_at: string;
  movement_count: number;
  last_movement_at?: string | null;
  last_movement_label?: string | null;
}

export interface UserMovementItem {
  id: string;
  kind: 'transfer' | 'wallet_transfer' | 'balance_transaction' | 'activity' | 'support';
  title: string;
  description: string;
  created_at: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  reference_id?: string | null;
}

export interface UserMovementFeed {
  user: ManagedDashboardUser;
  movements: UserMovementItem[];
  hasMore: boolean;
}

export async function getStaffMembers(): Promise<StaffMember[]> {
  return fetchJSON<StaffMember[]>('/api/staff');
}

export async function createAdminAccount(data: {
  name: string;
  email: string;
  phone: string;
  password: string;
  country?: string;
  city?: string;
}): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>('/api/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateStaffStatus(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>(`/api/staff/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function getStaffActivity(): Promise<StaffActivityItem[]> {
  return fetchJSON<StaffActivityItem[]>('/api/staff/activity');
}

export async function getManagedDashboardUsers(): Promise<ManagedDashboardUser[]> {
  return fetchJSON<ManagedDashboardUser[]>('/api/staff/users');
}

export async function getManagedUserMovements(id: string, limit: number = 60): Promise<UserMovementFeed> {
  return fetchJSON<UserMovementFeed>(`/api/staff/users/${encodeURIComponent(id)}?limit=${encodeURIComponent(String(limit))}`);
}
