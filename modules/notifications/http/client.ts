import { fetchJSON } from '@/services/http';

type MutationResult = { success: boolean; error?: string };
type NotificationKind = 'admin' | 'agent' | 'client';

function getNotifications(kind: NotificationKind, limit = 50): Promise<unknown[]> {
  return fetchJSON<unknown[]>(`/api/me/notifications?kind=${kind}&limit=${encodeURIComponent(String(limit))}`);
}

function markAllAsRead(kind: NotificationKind): Promise<MutationResult> {
  return fetchJSON<MutationResult>('/api/me/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  });
}

function getUnreadCount(kind: NotificationKind): Promise<number> {
  return fetchJSON<{ count: number }>(`/api/me/notifications/unread-count?kind=${kind}`)
    .then((data) => data.count || 0);
}

export const getAdminNotifications = (limit = 50) => getNotifications('admin', limit);
export const getAgentNotifications = (limit = 50) => getNotifications('agent', limit);
export const getClientNotifications = (limit = 50) => getNotifications('client', limit);

export function deleteNotification(notificationId: string): Promise<MutationResult> {
  return fetchJSON<MutationResult>(`/api/me/notifications?id=${encodeURIComponent(notificationId)}`, {
    method: 'DELETE',
  });
}

export function markNotificationAsRead(notificationId: string): Promise<MutationResult> {
  return fetchJSON<MutationResult>('/api/me/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: notificationId }),
  });
}

export const markAllNotificationsAsRead = () => markAllAsRead('agent');
export const markAllClientNotificationsAsRead = () => markAllAsRead('client');
export const markAllAdminNotificationsAsRead = () => markAllAsRead('admin');
export const getUnreadNotificationCount = () => getUnreadCount('agent');
export const getClientUnreadNotificationCount = () => getUnreadCount('client');
export const getAdminUnreadNotificationCount = () => getUnreadCount('admin');

