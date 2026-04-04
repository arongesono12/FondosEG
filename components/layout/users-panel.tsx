'use client';

import { useEffect, useState } from 'react';
import { cn, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Users, 
  Monitor, 
  Smartphone, 
  Globe, 
  MapPin,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
}

function parseUserAgent(ua: string): { device: UserPresence['device']; browser: string; os: string } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device: UserPresence['device'] = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let browser = 'Desconocido';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/OPR\//i.test(ua)) browser = 'Opera';

  let os = 'Desconocido';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { device, browser, os };
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
  admin: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  gestor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cliente: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export function UsersPanel({ open, onClose }: UsersPanelProps) {
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
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Slide-in Panel */}
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 h-screen w-[360px] max-w-full bg-card border-l border-border/20 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/10">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Usuarios</h2>
            {onlineCount > 0 && (
              <span className="h-5 px-1.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full flex items-center">
                {onlineCount} en línea
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadUsers}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Actualizar"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 p-3 border-b border-border/10">
          {(['all', 'online', 'offline'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all',
                filter === f
                  ? 'bg-brand-gradient text-white shadow-lg shadow-pink-500/20'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {f === 'all' ? 'Todos' : f === 'online' ? 'En línea' : 'Fuera'}
            </button>
          ))}
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-semibold">Cargando usuarios...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No hay usuarios</p>
            </div>
          ) : (
            filtered.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-2xl border border-border/20 bg-card/60 hover:bg-muted/40 transition-colors"
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
                      <Badge className={cn('text-[9px] font-bold uppercase px-1.5 py-0 h-4 border-none', roleColors[u.role] || 'bg-muted text-muted-foreground')}>
                        {u.role}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>

                    {/* Status row */}
                    <div className="flex items-center gap-1 mt-1">
                      {u.isOnline ? (
                        <Wifi className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-muted-foreground/50" />
                      )}
                      <span className={cn('text-[10px] font-semibold', u.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                        {u.isOnline ? 'En línea' : u.lastSeen ? timeAgo(u.lastSeen) : 'Sin actividad'}
                      </span>
                    </div>

                    {/* Device / Browser / OS row */}
                    {(u.device || u.browser || u.os) && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {u.device && (
                          <span className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded-lg">
                            <DeviceIcon device={u.device} />
                            {u.device === 'mobile' ? 'Móvil' : u.device === 'tablet' ? 'Tablet' : 'Navegador'}
                          </span>
                        )}
                        {u.browser && (
                          <span className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded-lg">
                            <Globe className="h-3 w-3" />
                            {u.browser}
                          </span>
                        )}
                        {u.os && (
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded-lg">
                            {u.os}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Location / IP */}
                    {(u.ipAddress || u.location) && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-muted-foreground/60" />
                        <span className="text-[9px] font-semibold text-muted-foreground">
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

        {/* Footer */}
        <div className="p-4 border-t border-border/10">
          <p className="text-[10px] text-muted-foreground text-center font-semibold uppercase tracking-wide">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrados · {onlineCount} activos
          </p>
        </div>
      </aside>
    </>
  );
}
