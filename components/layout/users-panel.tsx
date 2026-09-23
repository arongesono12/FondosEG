'use client';

import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DialogOverlay, DialogPortal, useDialogReturnFocus } from '@/components/ui/dialog';
import { ModalListSkeleton } from '@/components/skeletons/app-skeletons';
import {
  X,
  Users,
  Monitor,
  Smartphone,
  Globe,
  MapPin,
  Wifi,
  WifiOff,
  RefreshCw,
} from '@/components/ui/hugeicons';

interface UserPresence {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  is_active: boolean;
  isOnline: boolean;
  lastSeen?: string;
  device?: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
}

interface UsersPanelProps {
  open: boolean;
  onClose: () => void;
  /**
   * Dónde dejar el foco al cerrar si el control que abrió el panel ya no
   * existe: se abre desde una opción del menú de usuario, que desaparece con
   * el menú. Lo lógico es volver al botón que abre ese menú.
   */
  getReturnFocusTarget?: () => HTMLElement | null | undefined;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

const DeviceIcon = ({ device }: { device: UserPresence['device'] }) => {
  if (device === 'mobile' || device === 'tablet') return <Smartphone className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
};

const roleColors: Record<string, string> = {
  superadmin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  admin: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  gestor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cliente: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

/**
 * Cajón lateral «Usuarios» sobre un Dialog de Radix.
 *
 * Antes era un <aside> hecho a mano que seguía montado (con sus botones
 * enfocables) estando cerrado, sin `role`/`aria-modal`, sin trampa de foco,
 * sin devolución del foco ni Escape, con un bloqueo de scroll que sólo tocaba
 * <main> y por debajo de la barra inferior móvil. Radix aporta todo eso, y el
 * velo es el mismo que el de cualquier modal (`DialogOverlay`: `--dialog-scrim`
 * y `--z-overlay`). La superficie sigue siendo `.dashboard-drawer`, y la
 * animación de entrada y salida vive en dashboard-system.css.
 */
export function UsersPanel({ open, onClose, getReturnFocusTarget }: UsersPanelProps) {
  const returnFocus = useDialogReturnFocus({ fallback: getReturnFocusTarget });
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users-presence');
      const data: UserPresence[] = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Error loading users presence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadUsers();
  }, [open]);

  const filtered = users.filter((u) => {
    if (filter === 'online') return u.isOnline;
    if (filter === 'offline') return !u.isOnline;
    return true;
  });

  const onlineCount = users.filter((u) => u.isOnline).length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={returnFocus.onOpenAutoFocus}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
          className="dashboard-drawer fixed inset-y-0 right-0 z-(--z-overlay) flex h-dvh w-full flex-col outline-none sm:w-[min(420px,100vw)]"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/10 pb-3 pl-5 pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-2">
              <Users className="h-5 w-5 shrink-0 text-primary" />
              <DialogPrimitive.Title className="text-lg font-bold text-foreground">Usuarios</DialogPrimitive.Title>
              {onlineCount > 0 && (
                <span className="h-5 shrink-0 px-1.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full flex items-center">
                  {onlineCount} en línea
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={loadUsers}
                aria-label="Actualizar la lista de usuarios"
                className="grid size-11 place-items-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin motion-reduce:animate-none')} />
              </button>
              <DialogPrimitive.Close
                aria-label="Cerrar el panel de usuarios"
                className="grid size-11 place-items-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex shrink-0 gap-1 border-b border-border/10 p-3">
            {(['all', 'online', 'offline'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'min-h-11 flex-1 rounded-xl text-xs font-bold uppercase tracking-wide transition-all',
                  filter === f
                    ? 'bg-brand-gradient text-white shadow-lg shadow-pink-500/20'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {f === 'all' ? 'Todos' : f === 'online' ? 'En línea' : 'Fuera'}
              </button>
            ))}
          </div>

          {/* User List: la única zona que se desplaza. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-2">
            {loading ? (
              <ModalListSkeleton rows={6} />
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">No hay usuarios</p>
              </div>
            ) : (
              filtered.map((u) => (
                <div
                  key={u.id}
                  className="rounded-2xl border border-border/20 bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar + online dot */}
                    <div className="relative shrink-0">
                      <Avatar className="h-9 w-9 border border-border/20">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="bg-brand-gradient text-white text-xs font-bold">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
                          u.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                        )}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                        <Badge className={cn('text-[11px] font-bold uppercase px-1.5 py-0 h-4 border-none', roleColors[u.role] || 'bg-muted text-muted-foreground')}>
                          {u.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>

                      {/* Status row */}
                      <div className="flex items-center gap-1 mt-1">
                        {u.isOnline ? (
                          <Wifi className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <WifiOff className="h-3 w-3 text-muted-foreground/50" />
                        )}
                        <span className={cn('text-xs font-semibold', u.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                          {u.isOnline ? 'En línea' : u.lastSeen ? timeAgo(u.lastSeen) : 'Sin actividad'}
                        </span>
                      </div>

                      {/* Device / Browser / OS row */}
                      {(u.device || u.browser || u.os) && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {u.device && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded-lg">
                              <DeviceIcon device={u.device} />
                              {u.device === 'mobile' ? 'Móvil' : u.device === 'tablet' ? 'Tablet' : 'Navegador'}
                            </span>
                          )}
                          {u.browser && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded-lg">
                              <Globe className="h-3 w-3" />
                              {u.browser}
                            </span>
                          )}
                          {u.os && (
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded-lg">
                              {u.os}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Location / IP */}
                      {(u.ipAddress || u.location) && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {u.location || u.ipAddress}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer: respeta la zona segura inferior (barra de inicio de iOS). */}
          <div className="shrink-0 border-t border-border/10 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <p className="text-xs text-muted-foreground text-center font-semibold uppercase tracking-wide">
              {users.length} usuario{users.length !== 1 ? 's' : ''} registrados · {onlineCount} activos
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
