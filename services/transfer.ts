import type { Transfer, TransferFormData } from '@/types';
import { fetchJSON } from '@/services/http';

export async function getTransfers(limit: number = 50): Promise<Transfer[]> {
  return fetchJSON<Transfer[]>(`/api/transfers?limit=${encodeURIComponent(String(limit))}`);
}

export async function getAllTransfers(limit: number = 50): Promise<Transfer[]> {
  return getTransfers(limit);
}

export async function createTransfer(
  data: TransferFormData
): Promise<{ success: boolean; transfer?: Transfer; error?: string }> {
  return fetchJSON<{ success: boolean; transfer?: Transfer; error?: string }>('/api/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function correctTransfer(
  transferId: string,
  data: Partial<TransferFormData>
): Promise<{ success: boolean; transfer?: Transfer; error?: string }> {
  return fetchJSON<{ success: boolean; transfer?: Transfer; error?: string }>(
    `/api/transfers/${encodeURIComponent(transferId)}/correct`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
}

export async function createRevolutPayoutForTransfer(
  transferId: string
): Promise<{ success: boolean; transfer?: Transfer; error?: string }> {
  return fetchJSON<{ success: boolean; transfer?: Transfer; error?: string }>(
    `/api/transfers/${encodeURIComponent(transferId)}/revolut-payout`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export async function searchTransfers(query: string): Promise<Transfer[]> {
  return fetchJSON<Transfer[]>(`/api/transfers/search?q=${encodeURIComponent(query)}&limit=10`);
}

export async function getAdminNotifications(limit: number = 50): Promise<unknown[]> {
  return fetchJSON<unknown[]>(`/api/me/notifications?kind=admin&limit=${encodeURIComponent(String(limit))}`);
}

export async function getAgentNotifications(limit: number = 50): Promise<unknown[]> {
  return fetchJSON<unknown[]>(`/api/me/notifications?kind=agent&limit=${encodeURIComponent(String(limit))}`);
}

export async function getClientNotifications(limit: number = 50): Promise<unknown[]> {
  return fetchJSON<unknown[]>(`/api/me/notifications?kind=client&limit=${encodeURIComponent(String(limit))}`);
}

export async function deleteNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>(`/api/me/notifications?id=${encodeURIComponent(notificationId)}`, {
    method: 'DELETE',
  });
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>('/api/me/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: notificationId }),
  });
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>('/api/me/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'agent' }),
  });
}

export async function markAllClientNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>('/api/me/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'client' }),
  });
}

export async function markAllAdminNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>('/api/me/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'admin' }),
  });
}

export async function getUnreadNotificationCount(): Promise<number> {
  const data = await fetchJSON<{ count: number }>('/api/me/notifications/unread-count?kind=agent');
  return data.count || 0;
}

export async function getClientUnreadNotificationCount(): Promise<number> {
  const data = await fetchJSON<{ count: number }>('/api/me/notifications/unread-count?kind=client');
  return data.count || 0;
}

export async function getAdminUnreadNotificationCount(): Promise<number> {
  const data = await fetchJSON<{ count: number }>('/api/me/notifications/unread-count?kind=admin');
  return data.count || 0;
}
