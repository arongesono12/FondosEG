'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useClerk } from '@clerk/nextjs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardLogo } from './dashboard-logo';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Bell, 
  LayoutDashboard, 
  Send, 
  Users, 
  Wallet, 
  History,
  UserCog,
  LogOut,
  BarChart3,
  Settings,
  Moon,
  Sun,
  AlertTriangle,
  FileText,
  ShieldCheck,
  MoreHorizontal,
} from 'lucide-react';
import { UsersPanel } from './users-panel';
import { SearchModal } from './search-modal';
import { NotificationModal } from './notification-modal';
import { SettingsModal } from './settings-modal';
import { SupportModal } from './support-modal';
import { CookieConsentModal, type CookieConsentPreferences } from './cookie-consent-modal';
import { getUnreadNotificationCount, getClientUnreadNotificationCount, getAdminUnreadNotificationCount } from '@/modules/notifications/http/client';
import { getAgentBalance } from '@/services/agent';
import { useTheme } from '@/components/theme-provider';
import { HttpError } from '@/services/http';
import { getRoleLabel, isAdminRole } from '@/lib/roles';

const COOKIE_CONSENT_STORAGE_KEY_PREFIX = 'fondoseg_cookie_consent_v2';
const COOKIE_CONSENT_GLOBAL_STORAGE_KEY = `${COOKIE_CONSENT_STORAGE_KEY_PREFIX}:site`;
const COOKIE_CONSENT_COOKIE_NAME = 'fondoseg_cookie_consent';
const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

type CookieConsentStatus = 'accepted' | 'rejected' | 'configured';

type StoredCookieConsent = {
  status?: CookieConsentStatus;
  preferences?: Partial<CookieConsentPreferences>;
  updatedAt?: string;
};

function getCookieConsentStorageKey(userId?: string) {
  return `${COOKIE_CONSENT_STORAGE_KEY_PREFIX}:${userId || 'guest'}`;
}

function normalizeStoredCookieConsent(value: StoredCookieConsent | null): {
  status: CookieConsentStatus;
  preferences: CookieConsentPreferences;
} | null {
  if (!value?.status) return null;
  if (!['accepted', 'rejected', 'configured'].includes(value.status)) return null;

  return {
    status: value.status,
    preferences: {
      essential: true,
      preferences: Boolean(value.preferences?.preferences),
    },
  };
}

function readStoredCookieConsent(storageKey?: string) {
  if (typeof window === 'undefined') return null;

  const candidateKeys = [storageKey, COOKIE_CONSENT_GLOBAL_STORAGE_KEY].filter(Boolean) as string[];

  for (const key of candidateKeys) {
    try {
      const storedValue = window.localStorage.getItem(key);
      if (!storedValue) continue;
      const normalized = normalizeStoredCookieConsent(JSON.parse(storedValue) as StoredCookieConsent);
      if (normalized) return normalized;
    } catch {
      // Ignore malformed records and continue with the next persistence source.
    }
  }

  try {
    const cookieValue = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`))
      ?.split('=')
      .slice(1)
      .join('=');

    if (!cookieValue) return null;

    return normalizeStoredCookieConsent(JSON.parse(decodeURIComponent(cookieValue)) as StoredCookieConsent);
  } catch {
    return null;
  }
}

function writeStoredCookieConsent(storageKey: string, consent: {
  status: CookieConsentStatus;
  preferences: CookieConsentPreferences;
}) {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    ...consent,
    updatedAt: new Date().toISOString(),
  });

  try {
    window.localStorage.setItem(storageKey, payload);
    window.localStorage.setItem(COOKIE_CONSENT_GLOBAL_STORAGE_KEY, payload);
  } catch {
    // Cookie fallback below keeps the consent durable when localStorage is unavailable.
  }

  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${encodeURIComponent(payload)}; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Some privacy modes may block document.cookie. In that case localStorage is enough.
  }
}

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAppStore();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [cookieConsentOpen, setCookieConsentOpen] = useState(false);
  const [cookiePreferences, setCookiePreferences] = useState<CookieConsentPreferences>({
    essential: true,
    preferences: true,
  });
  const [scrolled, setScrolled] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [lowBalance, setLowBalance] = useState(false);
  const [usersPanelOpen, setUsersPanelOpen] = useState(false);
  
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user?.id) return;

    const storageKey = getCookieConsentStorageKey(user.id);

    const storedConsent = readStoredCookieConsent(storageKey);

    if (!storedConsent) {
      setCookieConsentOpen(true);
      return;
    }

    setCookiePreferences(storedConsent.preferences);
    setCookieConsentOpen(false);
  }, [mounted, user?.id]);

  useEffect(() => {
    const mainArea = document.querySelector('main');
    if (!mainArea) return;

    // Listener pasivo + rAF: el handler cambia la altura de la cabecera, así que
    // sin acotarlo provoca layout en cada evento de scroll.
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setScrolled(mainArea.scrollTop > 10);
        frame = 0;
      });
    };

    mainArea.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      mainArea.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // El contenedor desplazable NO es el mismo en los dos tamaños:
  //   - Móvil: `<main>`, porque la carcasa mide el alto exacto de la pantalla
  //     y `.dashboard-public-page` es `overflow: hidden`.
  //   - Escritorio: el documento, para que la barra de scroll salga en el
  //     borde de la ventana y no dentro de la tarjeta.
  // Se actúa sobre los dos: el que no esté desplazándose ignora la llamada.
  const scrollMainToTop = useCallback(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    async function loadNotificationCount() {
      if (!user?.id) return;
      try {
        if (isAdminRole(user.role)) {
          const count = await getAdminUnreadNotificationCount();
          setNotificationCount(count);
        } else if (user.role === 'gestor') {
          const count = await getUnreadNotificationCount();
          setNotificationCount(count);
        } else if (user.role === 'cliente') {
          const count = await getClientUnreadNotificationCount();
          setNotificationCount(count);
        }
      } catch (error) {
        if (error instanceof Error && error.message?.includes('Failed to fetch')) return;
        if (!(error instanceof HttpError && error.status === 401)) {
          console.warn('Error loading notification count:', error);
        }
      }
    }
    loadNotificationCount();
    const interval = setInterval(loadNotificationCount, 30000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role]);

  useEffect(() => {
    async function checkLowBalance() {
      if (!user?.id || user.role !== 'gestor') {
        setLowBalance(false);
        return;
      }
      try {
        const balanceData = await getAgentBalance(user.id);
        const balance = balanceData?.balance || 0;
        setLowBalance(balance < 25000);
      } catch (error) {
        if (error instanceof Error && error.message?.includes('Failed to fetch')) return;
        if (!(error instanceof HttpError && error.status === 401)) {
          console.warn('Error checking balance:', error);
        }
      }
    }
    checkLowBalance();
    const interval = setInterval(checkLowBalance, 30000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role]);

  const handleSignOut = async () => {
    // Se limpia el estado local antes de que Clerk navegue, para que el shell
    // no repinte con el usuario anterior durante la redirección.
    setUser(null);
    await signOut({ redirectUrl: '/login' });
  };

  const persistCookieConsent = (status: CookieConsentStatus, preferences: CookieConsentPreferences) => {
    setCookiePreferences(preferences);
    setCookieConsentOpen(false);

    if (!mounted || !user?.id) return;

    const storageKey = getCookieConsentStorageKey(user.id);
    writeStoredCookieConsent(storageKey, { status, preferences });
  };
  
  const navItems = isAdminRole(user?.role)
    ? [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/transfers', label: 'Envíos', icon: Send },
        { href: '/agents', label: 'Gestores', icon: Users },
        { href: '/balance', label: 'Saldos', icon: Wallet },
        { href: '/stats', label: 'Estadísticas', icon: BarChart3 },
        { href: '/history', label: 'Historial', icon: History },
        ...(user?.role === 'superadmin' ? [{ href: '/staff', label: 'Administración', icon: ShieldCheck }] : []),
      ]
    : [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/transfers', label: 'Enviar', icon: Send },
        { href: '/balance', label: 'Billetera', icon: Wallet },
        { href: '/history', label: 'Actividad', icon: History },
      ];

  // La barra inferior aloja 4 destinos + un quinto hueco (Buscar, o "Más" si
  // sobran destinos). Con 8 elementos —el caso de superadmin— cada objetivo
  // caería a 44px en una pantalla de 360px y el desbordamiento quedaba oculto
  // tras un scroll horizontal sin ninguna señal visual.
  const primaryNavItems = navItems.slice(0, 4);
  const overflowNavItems = navItems.slice(4);

  const userMenuDropdown = (avatarClassName?: string, showMobileName = false) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]",
            showMobileName
              ? "dashboard-mobile-user-trigger"
              : "rounded-full"
          )}
        >
          <Avatar className={cn("border border-border/20 shadow-sm", avatarClassName || "h-10 w-10")}>
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-brand-gradient text-white font-black text-xs">
              {getInitials(user?.name || 'U')}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      {showMobileName ? (
        <DropdownMenuContent className="w-[min(calc(100vw-24px),16rem)] rounded-2xl" align="end" sideOffset={10} forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none">{user?.name}</p>
              <p className="text-[10px] font-medium text-muted-foreground capitalize">
                {getRoleLabel(user?.role)}
              </p>
            </div>
          </DropdownMenuLabel>
          {user?.role === 'gestor' && lowBalance && (
            <DropdownMenuItem
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 cursor-pointer"
              onClick={() => setSupportOpen(true)}
            >
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">
                Saldo bajo - Contacte administrador
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuración</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/profile')}>
            <UserCog className="mr-2 h-4 w-4" />
            <span>Mi Perfil</span>
          </DropdownMenuItem>
          {isAdminRole(user?.role) && (
            <DropdownMenuItem onClick={() => setUsersPanelOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              <span>Usuarios conectados</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/landing/privacidad')}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            <span>Privacidad</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/landing/terminos')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Términos y condiciones</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-rose-500 focus:text-rose-500 focus:bg-rose-500/10">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      ) : (
      <DropdownMenuContent className="w-[min(calc(100vw-24px),16rem)] rounded-2xl" align="end" sideOffset={10} forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none">{user?.name}</p>
            <p className="text-[10px] font-medium text-muted-foreground capitalize">
              {getRoleLabel(user?.role)}
            </p>
          </div>
        </DropdownMenuLabel>
        {user?.role === 'gestor' && lowBalance && (
          <DropdownMenuItem
            className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 cursor-pointer"
            onClick={() => setSupportOpen(true)}
          >
            <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">
              âš ï¸ Saldo bajo - Contacte administrador
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Configuración</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/profile')}>
          <UserCog className="mr-2 h-4 w-4" />
          <span>Mi Perfil</span>
        </DropdownMenuItem>
        {isAdminRole(user?.role) && (
          <DropdownMenuItem onClick={() => setUsersPanelOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            <span>Usuarios conectados</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/landing/privacidad')}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          <span>Privacidad</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/landing/terminos')}>
          <FileText className="mr-2 h-4 w-4" />
          <span>Términos y condiciones</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-rose-500 focus:text-rose-500 focus:bg-rose-500/10">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
      )}
    </DropdownMenu>
  );

  return (
    <div suppressHydrationWarning className="dashboard-public-page main-container min-h-screen font-sans">
      
      {/* Mobile: Full screen card | Desktop: Max width card with rounded top corners */}
      <div className={cn(
        "mx-auto w-full relative flex flex-col",
        // `min-h` y no `h`: en escritorio la tarjeta ocupa como mínimo el alto
        // de la ventana —el aspecto de siempre— pero puede crecer con el
        // contenido, que es lo que permite que el scroll lo lleve el
        // documento y la barra siga en el borde de la ventana.
        "lg:max-w-[1440px] lg:min-h-[calc(100vh-4rem)] lg:rounded-[2.5rem] lg:shadow-xl lg:shadow-slate-200/20 dark:lg:shadow-black/20 lg:border lg:border-border/10",
        "h-dvh lg:h-auto"
      )}>
        {/* Top Header Navigation - rounded top corners to match container */}
        <header className={cn(
          "hidden lg:flex h-20 items-center justify-between px-10 border-b border-border/10 shrink-0 transition-all duration-300 z-50",
          "bg-linear-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950",
          "lg:rounded-t-[2.5rem]",
          scrolled && "h-16 shadow-lg shadow-black/5"
        )}>
          {/* Left side: Logo + Nav */}
          <div className="flex items-center gap-2">
            <Link 
              href="/" 
              className="flex items-center gap-2"
              onClick={() => {
                scrollMainToTop();
              }}
            >
              <DashboardLogo
                size="md"
                labelClassName="text-xl md:text-2xl"
              />
            </Link>

            <nav className="hidden lg:flex items-center gap-1 ml-4">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    className={cn(
                      "px-5 py-2 rounded-full text-sm font-bold transition-all duration-300",
                      isActive 
                        ? "bg-brand-gradient text-white shadow-lg shadow-pink-500/20" 
                        : "text-muted-foreground hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-500/20"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side: Search + Notifications + Theme (desktop) + Avatar + Menu (mobile) */}
          <div className="flex items-center gap-1 md:gap-4">
            {/* Desktop: Search + Notifications + Theme */}
            <div className="hidden md:flex items-center gap-1 md:gap-2 text-muted-foreground">
              <button 
                onClick={() => setSearchOpen(true)}
                className="p-2 hover:bg-pink-100 dark:hover:bg-pink-500/20 rounded-full transition-colors text-foreground/70 hover:text-pink-600 dark:hover:text-pink-400"
              >
                <Search className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setNotificationsOpen(true)}
                className="p-2 hover:bg-pink-100 dark:hover:bg-pink-500/20 rounded-full transition-colors relative text-foreground/70 hover:text-pink-600 dark:hover:text-pink-400"
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </button>
              <ThemeToggle />
            </div>

            <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-6 border-l border-border/50">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-foreground leading-tight">{user?.name || 'Usuario'}</p>
                <p className="text-[10px] font-medium text-muted-foreground capitalize">
                  {getRoleLabel(user?.role)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-10 w-10 border border-border/20 shadow-sm cursor-pointer transition-transform hover:scale-105 active:scale-95">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="bg-brand-gradient text-white font-black text-xs">
                      {getInitials(user?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{user?.name}</p>
                      <p className="text-[10px] font-medium text-muted-foreground capitalize">
                        {getRoleLabel(user?.role)}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  {/* Alerta de saldo bajo para gestores */}
                  {user?.role === 'gestor' && lowBalance && (
                    <DropdownMenuItem 
                      className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 cursor-pointer"
                      onClick={() => setSupportOpen(true)}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">
                        ⚠️ Saldo bajo - Contacte administrador
                      </span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {/* Mobile only options */}
                  <DropdownMenuItem onClick={() => setSearchOpen(true)} className="md:hidden">
                    <Search className="mr-2 h-4 w-4" />
                    <span>Buscar</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setNotificationsOpen(true)} className="md:hidden">
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Notificaciones</span>
                    {notificationCount > 0 && (
                      <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')} className="md:hidden">
                    {!mounted ? (
                      <>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>Tema</span>
                      </>
                    ) : isDark ? (
                      <>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Modo Claro</span>
                      </>
                    ) : (
                      <>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>Modo Oscuro</span>
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="md:hidden" />
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <UserCog className="mr-2 h-4 w-4" />
                    <span>Mi Perfil</span>
                  </DropdownMenuItem>
                  {isAdminRole(user?.role) && (
                    <DropdownMenuItem onClick={() => setUsersPanelOpen(true)}>
                      <Users className="mr-2 h-4 w-4" />
                      <span>Usuarios conectados</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/landing/privacidad')}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>Privacidad</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/landing/terminos')}>
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Términos y condiciones</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-rose-500 focus:text-rose-500 focus:bg-rose-500/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            </div>
          </header>

        <header className="dashboard-mobile-header lg:hidden">
          <Link
            href="/dashboard"
            className="dashboard-mobile-brand"
            aria-label="FondosEG dashboard"
            onClick={scrollMainToTop}
          >
            <DashboardLogo size="sm" labelClassName="text-lg" />
          </Link>
          <div className="dashboard-mobile-header-actions">
            <button
              type="button"
              className="dashboard-mobile-header-action"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              className="dashboard-mobile-header-action"
              onClick={() => setNotificationsOpen(true)}
              aria-label="Abrir notificaciones"
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="dashboard-mobile-header-badge">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
            {userMenuDropdown("h-10 w-10", true)}
          </div>
        </header>

        {/* Content Area */}
        {/*
          Móvil: `<main>` es el contenedor desplazable, porque la carcasa mide
          exactamente el alto de la pantalla y la barra inferior es fija.

          Escritorio: el que se desplaza es el DOCUMENTO, así que la barra
          vuelve al borde de la ventana en lugar de aparecer dentro de la
          tarjeta. Para eso `main` deja de ser contenedor de scroll
          (`lg:overflow-visible`); si se quedara en `overflow-y-auto` con
          `overscroll-contain`, se tragaría la rueda del ratón sin nada que
          desplazar, que era el fallo original.

          Se retira `scrollbar-hide`: no está definida en ninguna parte —ni
          como utilidad ni por plugin—, así que nunca ocultó nada. Era la
          razón de que la barra interna se viera al hacer scroll aquí.
        */}
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain lg:overflow-visible lg:overscroll-auto bg-transparent p-4 pb-28 lg:p-10">
          {children}
        </main>

        <nav className="dashboard-mobile-bottom-bar lg:hidden" aria-label="Navegación principal del dashboard">
          <div className="dashboard-mobile-bottom-scroll">
            {primaryNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={scrollMainToTop}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn("dashboard-mobile-action", isActive && "is-active")}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {overflowNavItems.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "dashboard-mobile-action",
                      overflowNavItems.some((item) => item.href === pathname) && "is-active"
                    )}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                    <span>Más</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-56 rounded-2xl">
                  {overflowNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                    <Search className="mr-2 h-4 w-4" />
                    <span>Buscar</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button type="button" className="dashboard-mobile-action" onClick={() => setSearchOpen(true)}>
                <Search className="h-5 w-5" />
                <span>Buscar</span>
              </button>
            )}
          </div>
        </nav>

        {/* Modals */}
        <UsersPanel open={usersPanelOpen} onClose={() => setUsersPanelOpen(false)} />
        <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
        <NotificationModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        <SupportModal open={supportOpen} onOpenChange={setSupportOpen} requestType="balance_topup" />
        <CookieConsentModal
          open={cookieConsentOpen}
          initialPreferences={cookiePreferences}
          onAcceptAll={() =>
            persistCookieConsent('accepted', {
              essential: true,
              preferences: true,
            })
          }
          onRejectOptional={() =>
            persistCookieConsent('rejected', {
              essential: true,
              preferences: false,
            })
          }
          onSaveConfiguration={(preferences) => persistCookieConsent('configured', preferences)}
        />
      </div>
    </div>
  );
}
