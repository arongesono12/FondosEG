'use client';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ModalListSkeleton } from '@/components/skeletons/app-skeletons';
import { 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Trash2, 
  CheckCheck,
  Mail,
  MailOpen,
} from 'lucide-react';
import {
  getAdminNotifications,
  getAgentNotifications,
  getClientNotifications,
  deleteNotification,
  markNotificationAsRead,
  markAllAdminNotificationsAsRead,
  markAllClientNotificationsAsRead,
  markAllNotificationsAsRead,
} from '@/services/transfer';
import { useAppStore } from '@/lib/store';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCallback, useEffect, useState } from 'react';
import { Notification, Transfer } from '@/types';
import { HttpError } from '@/services/http';
import { isAdminRole } from '@/lib/roles';
import { formatDateShort } from '@/lib/utils';

type NotificationWithTransfer = Notification & {
  transfer?: Pick<Transfer, 'transfer_code' | 'sender_name' | 'receiver_name' | 'receiver_phone' | 'amount' | 'currency' | 'destination_city' | 'created_at'> | null;
};

interface NotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function NotificationModal({ open, onOpenChange }: NotificationModalProps) {
  const { user } = useAppStore();
  const [notifications, setNotifications] = useState<NotificationWithTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<NotificationWithTransfer | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let data;
      if (isAdminRole(user.role)) {
        data = await getAdminNotifications();
      } else if (user.role === 'cliente') {
        data = await getClientNotifications();
      } else {
        data = await getAgentNotifications();
      }
      setNotifications(data as NotificationWithTransfer[]);
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 401)) {
        console.error('Error loading notifications:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (open && user?.id) {
      loadNotifications();
    }
  }, [open, user?.id, loadNotifications]);

  const handleDelete = async (notificationId: string) => {
    setDeleting(notificationId);
    try {
      const result = await deleteNotification(notificationId);
      if (result.success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (selectedNotification?.id === notificationId) {
          setSelectedNotification(null);
        }
      }
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 401)) {
        console.error('Error deleting notification:', error);
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markNotificationAsRead(notificationId);
      if (result.success) {
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        ));
        if (selectedNotification?.id === notificationId) {
          setSelectedNotification(prev => prev ? { ...prev, is_read: true, read_at: new Date().toISOString() } : null);
        }
      }
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 401)) {
        console.error('Error marking notification as read:', error);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    try {
      let result;
      if (isAdminRole(user.role)) {
        result = await markAllAdminNotificationsAsRead();
      } else if (user.role === 'cliente') {
        result = await markAllClientNotificationsAsRead();
      } else {
        result = await markAllNotificationsAsRead();
      }
      if (result.success) {
        setNotifications(prev => prev.map(n => ({ 
          ...n, 
          is_read: true, 
          read_at: new Date().toISOString() 
        })));
      }
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 401)) {
        console.error('Error marking all notifications as read:', error);
      }
    }
  };

  const handleOpenNotification = async (notification: NotificationWithTransfer) => {
    setSelectedNotification(notification);
    if (!notification.is_read) {
      try {
        await handleMarkAsRead(notification.id);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) {
          console.error('Error opening notification:', error);
        }
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!left-0 !top-0 !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none border-0 bg-background/95 p-0 backdrop-blur-xl sm:!left-1/2 sm:!top-1/2 sm:!h-auto sm:!max-h-[80vh] sm:!w-full sm:!max-w-md sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-[10px] sm:border sm:bg-white/40 sm:dark:bg-[#10121B]/40 overflow-hidden flex flex-col">
          <DialogHeader className="px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))] border-b border-border/10 shrink-0 text-left sm:p-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <Bell className="h-5 w-5 text-primary" /> Notificaciones
              </DialogTitle>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar todo como leído
                </button>
              )}
            </div>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground font-medium">
                {unreadCount} notificación{unreadCount !== 1 ? 's' : ''} sin leer
              </p>
            )}
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-4">
            {loading ? (
              <div className="py-2">
                <ModalListSkeleton rows={5} />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-20 text-center">
                <Bell className="h-12 w-12 text-muted/30 mx-auto mb-4" />
                <p className="font-medium text-muted-foreground">No hay notificaciones</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleOpenNotification(notif)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer group relative",
                    notif.is_read
                      ? "bg-muted/20 border-border/5 hover:bg-muted/30"
                      : "bg-primary/5 border-primary/10 hover:bg-primary/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-xl shrink-0 mt-0.5",
                      notif.status === 'sent' ? "bg-green-100 text-green-600 dark:bg-green-900/30" : 
                      notif.status === 'failed' ? "bg-red-100 text-red-600 dark:bg-red-900/30" : 
                      "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                    )}>
                      {notif.status === 'sent' ? <CheckCircle className="h-4 w-4" /> : 
                       notif.status === 'failed' ? <AlertCircle className="h-4 w-4" /> : 
                       <Clock className="h-4 w-4" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-foreground uppercase tracking-tighter truncate">
                          {notif.transfer?.transfer_code || 'ADMIN'}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {mounted
                              ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })
                              : formatDateShort(notif.created_at)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-foreground/70 leading-relaxed line-clamp-2 mt-1">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          Para: {notif.transfer?.receiver_name || notif.phone}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest",
                          notif.status === 'sent' ? "text-green-500" : "text-red-500"
                        )}>
                          SMS {notif.status === 'sent' ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(notif.id);
                    }}
                    disabled={deleting === notif.id}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
                    title="Eliminar"
                  >
                    {deleting === notif.id ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
          
          <div className="hidden p-3 bg-muted/20 border-t border-border/5 justify-center shrink-0 sm:flex">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              FondosEG Notification System
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle de Notificación */}
      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="!left-0 !top-0 !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none border-0 bg-background/95 p-0 backdrop-blur-xl sm:!left-1/2 sm:!top-1/2 sm:!h-auto sm:!max-h-[88vh] sm:!w-full sm:!max-w-lg sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-[10px] sm:border sm:bg-white/40 sm:dark:bg-[#10121B]/40 overflow-hidden outline-none flex flex-col">
          <DialogHeader className="px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))] border-b border-border/10 shrink-0 text-left sm:p-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
                {selectedNotification?.is_read ? (
                  <MailOpen className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Mail className="h-5 w-5 text-primary" />
                )}
                Detalle de Notificación
              </DialogTitle>
            </div>
          </DialogHeader>
          
          {selectedNotification && (
            <div className="flex-1 overflow-y-auto px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-5 sm:p-6">
              {/* Estado */}
              <div className={cn(
                "p-4 rounded-2xl flex items-center gap-3",
                selectedNotification.status === 'sent' ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" :
                selectedNotification.status === 'failed' ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" :
                "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
              )}>
                {selectedNotification.status === 'sent' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : selectedNotification.status === 'failed' ? (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {selectedNotification.status === 'sent' ? 'SMS Enviado exitosamente' : 
                     selectedNotification.status === 'failed' ? 'SMS Fallido' : 
                     'SMS Pendiente'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedNotification.status === 'sent' && selectedNotification.sent_at 
                        ? `Enviado el ${format(new Date(selectedNotification.sent_at), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}`
                        : selectedNotification.status === 'failed' && selectedNotification.error_message
                        ? selectedNotification.error_message
                        : 'Esperando procesamiento...'}
                  </p>
                </div>
              </div>

              {/* Código de transferencia */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código de Transferencia</label>
                <p className="text-lg font-bold text-primary">{selectedNotification.transfer?.transfer_code || 'ADMIN'}</p>
              </div>

              {/* Información del mensaje */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensaje Enviado</label>
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/10">
                  <p className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedNotification.message}
                  </p>
                </div>
              </div>

              {/* Datos del destinatario */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destinatario</label>
                  <p className="text-sm font-medium text-foreground">{selectedNotification.transfer?.receiver_name || 'Administración'}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teléfono</label>
                  <p className="text-sm font-medium text-foreground">{selectedNotification.transfer?.receiver_phone || selectedNotification.phone}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monto</label>
                  <p className="text-sm font-semibold text-green-600">
                    {selectedNotification.transfer
                      ? `${selectedNotification.transfer.amount} ${selectedNotification.transfer.currency}`
                      : 'N/A'}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ciudad</label>
                  <p className="text-sm font-medium text-foreground">{selectedNotification.transfer?.destination_city || 'Sistema'}</p>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-border/10 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha de creación</label>
                  <p className="text-xs font-medium text-foreground">
                    {format(new Date(selectedNotification.created_at), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
                {selectedNotification.read_at && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha de lectura</label>
                    <p className="text-xs font-medium text-foreground">
                      {format(new Date(selectedNotification.read_at), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                )}
              </div>

              {/* Teléfono del destinatario del SMS */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teléfono que recibió el SMS</label>
                <p className="text-sm font-medium text-foreground">{selectedNotification.phone}</p>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => handleDelete(selectedNotification.id)}
                  className="flex-1 h-11 rounded-xl font-bold text-red-500 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
                <Button
                  onClick={() => setSelectedNotification(null)}
                  className="flex-1 h-11 rounded-xl bg-brand-gradient text-white font-bold shadow-lg"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
