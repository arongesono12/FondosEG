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
