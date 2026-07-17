/**
 * @deprecated Import from the appropriate domain module instead.
 * Kept as a compatibility adapter for external consumers during migration.
 */
export {
  correctTransfer,
  createRevolutPayoutForTransfer,
  createTransfer,
  getAllTransfers,
  getTransfers,
  searchTransfers,
} from '@/modules/transfers/http/client';

export {
  deleteNotification,
  getAdminNotifications,
  getAdminUnreadNotificationCount,
  getAgentNotifications,
  getClientNotifications,
  getClientUnreadNotificationCount,
  getUnreadNotificationCount,
  markAllAdminNotificationsAsRead,
  markAllClientNotificationsAsRead,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/modules/notifications/http/client';
