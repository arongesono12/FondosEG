'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DashboardLogo } from './dashboard-logo';
import {
  LayoutDashboard,
  Send,
  Users,
  Wallet,
  BarChart3,
  History,
  Menu,
  X,
  LogOut,
  UserCog,
  UsersRound,
  KeyRound,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { useState } from 'react';
import { UsersPanel } from './users-panel';
import { isAdminRole } from '@/lib/roles';

const adminRoutes = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/transfers', label: 'Transferencias', icon: Send },
  { href: '/agents', label: 'Gestores', icon: Users },
  { href: '/balance', label: 'Saldos', icon: Wallet },
  { href: '/stats', label: 'Estadísticas', icon: BarChart3 },
  { href: '/history', label: 'Historial', icon: History },
  { href: '/developer-console', label: 'Portal API', icon: KeyRound },
  { href: '/documentation', label: 'Documentación', icon: BookOpen },
  { href: '/compliance', label: 'Cumplimiento', icon: ShieldCheck },
  { href: '/profile', label: 'Perfil', icon: UserCog },
];

const agentRoutes = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/transfers', label: 'Nueva transferencia', icon: Send },
  { href: '/history', label: 'Mis transferencias', icon: History },
  { href: '/balance', label: 'Mi saldo', icon: Wallet },
  { href: '/documentation', label: 'Documentación', icon: BookOpen },
  { href: '/compliance', label: 'Cumplimiento', icon: ShieldCheck },
  { href: '/profile', label: 'Mi perfil', icon: UserCog },
];

const clientRoutes = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/transfers', label: 'Enviar dinero', icon: Send },
  { href: '/history', label: 'Mis transferencias', icon: History },
  { href: '/balance', label: 'Mi saldo', icon: Wallet },
  { href: '/documentation', label: 'Documentación', icon: BookOpen },
  { href: '/compliance', label: 'Cumplimiento', icon: ShieldCheck },
  { href: '/profile', label: 'Mi perfil', icon: UserCog },
];

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, toggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const [usersPanelOpen, setUsersPanelOpen] = useState(false);
  
  const routes = isAdminRole(user?.role)
    ? [...adminRoutes, ...(user?.role === 'superadmin' ? [{ href: '/staff', label: 'Administración', icon: UsersRound }] : [])]
    : user?.role === 'gestor' 
      ? agentRoutes 
      : clientRoutes;

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // Si la red falla, limpiamos la sesión local para no dejar bloqueada la UI.
    }
    setUser(null);
    router.push('/login');
  };

  return (
    <>
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col transition-all duration-300 glass-premium border-r-0 rounded-none",
        isCollapsed ? "w-20" : "w-64"
      )}>
        <div className="flex h-20 items-center px-6 justify-between">
          <Link href="/dashboard" className="flex items-center">
            <DashboardLogo
              showLabel={!isCollapsed}
              size="lg"
              className={cn(isCollapsed && "justify-center")}
              labelClassName="text-brand-gradient text-3xl"
            />
          </Link>
        </div>
        
        <nav className="flex-1 space-y-2 p-4 mt-4">
          {routes.map((route) => {
            const isActive = pathname === route.href;
            const Icon = route.icon;
            return (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center rounded-2xl transition-all duration-300 group relative py-3.5",
                  isCollapsed ? "justify-center" : "px-4 gap-4",
                  isActive
                    ? "bg-brand-gradient text-white shadow-xl shadow-pink-500/20"
                    : "text-muted-foreground hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-500/20 transition-colors"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-muted-foreground group-hover:text-pink-600 dark:group-hover:text-pink-400")} />
                {!isCollapsed && <span className="font-medium">{route.label}</span>}
                {isActive && !isCollapsed && (
                  <div className="absolute right-4 h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </Link>
            );
          })}

          {/* Admin-only: Users Panel Button */}
          {isAdminRole(user?.role) && (
            <button
              onClick={() => setUsersPanelOpen(true)}
              className={cn(
                "w-full flex items-center rounded-2xl transition-all duration-300 group relative py-3.5",
                isCollapsed ? "justify-center" : "px-4 gap-4",
                "text-muted-foreground hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-500/20 transition-colors"
              )}
            >
              <UsersRound className="h-5 w-5 text-muted-foreground group-hover:text-pink-600 dark:group-hover:text-pink-400" />
              {!isCollapsed && <span className="font-medium">Usuarios</span>}
            </button>
          )}
        </nav>

        <div className="p-4 flex flex-col gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapse}
            className={cn(
              "text-muted-foreground hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-500/20 rounded-2xl",
              isCollapsed ? "justify-center" : "justify-start gap-3 h-11 px-4"
            )}
          >
            {isCollapsed ? <Menu className="h-5 w-5" /> : (
              <>
                <X className="h-5 w-5" />
                <span className="font-medium">Colapsar</span>
              </>
            )}
          </Button>
          
          <div className={cn("flex items-center gap-3 p-2 rounded-3xl bg-primary/5", isCollapsed && "justify-center bg-transparent")}>
            <Avatar className="h-10 w-10 border-2 border-primary/20 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push('/profile')}>
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="bg-brand-gradient text-white font-bold">
                {user ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden hidden lg:block">
                <p className="text-sm font-semibold text-primary truncate">{user?.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{user?.role}</p>
              </div>
            )}
          </div>

          <Button 
            variant="ghost"
            size="sm"
            className={cn(
              "w-full transition-all text-muted-foreground hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 rounded-2xl",
              isCollapsed ? "justify-center h-11 p-0" : "justify-start gap-3 px-4 h-11"
            )}
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && <span className="font-medium">Cerrar sesión</span>}
          </Button>
        </div>
      </aside>

      {/* Feature 3: Admin Users Panel */}
      {isAdminRole(user?.role) && (
        <UsersPanel open={usersPanelOpen} onClose={() => setUsersPanelOpen(false)} />
      )}
    </>
  );
}
