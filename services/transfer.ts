import type { Notification, Transfer, TransferFormData } from '@/types';

async function fetchJSON<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed: ${res.status}`);
  }
  return data as T;
}

export async function getTransfers(_userId: string, limit: number = 50): Promise<Transfer[]> {
  return fetchJSON<Transfer[]>(`/api/transfers?limit=${encodeURIComponent(String(limit))}`);
}

export async function getAllTransfers(limit: number = 50): Promise<Transfer[]> {
  return fetchJSON<Transfer[]>(`/api/transfers?limit=${encodeURIComponent(String(limit))}`);
}

export async function createTransfer(
  data: TransferFormData,
  _agentId: string
): Promise<{ success: boolean; transfer?: Transfer; error?: string }> {
  return fetchJSON<{ success: boolean; transfer?: Transfer; error?: string }>('/api/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function searchTransfers(query: string, _agentId?: string) {
  return fetchJSON<Transfer[]>(`/api/transfers/search?q=${encodeURIComponent(query)}&limit=10`);
}

export async function getAdminNotifications(limit: number = 50) {
  return fetchJSON<any[]>(`/api/me/notifications?kind=admin&limit=${encodeURIComponent(String(limit))}`);
}

export async function getAgentNotifications(_agentId: string, limit: number = 50) {
  return fetchJSON<any[]>(`/api/me/notifications?kind=agent&limit=${encodeURIComponent(String(limit))}`);
}

export async function getClientNotifications(_clientId: string, limit: number = 50) {
  return fetchJSON<any[]>(`/api/me/notifications?kind=client&limit=${encodeURIComponent(String(limit))}`);
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

export async function markAllNotificationsAsRead(_agentId: string): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>('/api/me/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'agent' }),
  });
}

export async function markAllClientNotificationsAsRead(_clientId: string): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>('/api/me/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'client' }),
  });
}

export async function getUnreadNotificationCount(_agentId: string): Promise<number> {
  const data = await fetchJSON<{ count: number }>('/api/me/notifications/unread-count?kind=agent');
  return data.count || 0;
}

export async function getClientUnreadNotificationCount(_clientId: string): Promise<number> {
  const data = await fetchJSON<{ count: number }>('/api/me/notifications/unread-count?kind=client');
  return data.count || 0;
}

export async function getAdminUnreadNotificationCount(): Promise<number> {
  const data = await fetchJSON<{ count: number }>('/api/me/notifications/unread-count?kind=admin');
  return data.count || 0;
}
