'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@/components/ui/hugeicons';
import { UsersPanel } from './users-panel';
import { SearchModal } from './search-modal';
import { HeaderSearch } from './header-search';
import { NotificationsDropdown } from './notifications-dropdown';
import { SettingsModal } from './settings-modal';
import { SupportModal } from './support-modal';
import { CookieConsentModal, type CookieConsentPreferences } from './cookie-consent-modal';
import { getUnreadNotificationCount, getClientUnreadNotificationCount, getAdminUnreadNotificationCount } from '@/modules/notifications/http/client';
import { getAgentBalance } from '@/services/agent';
import { useTheme } from '@/components/theme-provider';
import { HttpError } from '@/services/http';
import { getRoleLabel, isAdminRole } from '@/lib/roles';
import { DashboardModulePanel } from '@/components/dashboard/dashboard-module-panel';
import {
  canAccessDashboardModule,
  getDashboardModuleFromPath,
  getDashboardNavigationHref,
  parseDashboardModule,
} from '@/components/dashboard/dashboard-modules';

const COOKIE_CONSENT_STORAGE_KEY_PREFIX = 'fondoseg_cookie_consent_v2';
const COOKIE_CONSENT_GLOBAL_STORAGE_KEY = `${COOKIE_CONSENT_STORAGE_KEY_PREFIX}:site`;
const COOKIE_CONSENT_COOKIE_NAME = 'fondoseg_cookie_consent';
const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

// Enlaces que caben en línea en la cabecera de escritorio por debajo de 1280px.
const DESKTOP_INLINE_NAV_ITEMS = 5;

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
  const searchParams = useSearchParams();
  const { signOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [moduleNotice, setModuleNotice] = useState<string | null>(null);

  // «Usuarios conectados» se abre desde una opción del menú de usuario, que
  // desaparece con el menú: al cerrar el panel el foco caería en <body>. Se
  // devuelve al disparador del menú que esté visible (escritorio o móvil).
  const desktopUserMenuRef = useRef<HTMLButtonElement>(null);
  const mobileUserMenuRef = useRef<HTMLButtonElement>(null);
  const getUserMenuTrigger = useCallback(
    () => [desktopUserMenuRef.current, mobileUserMenuRef.current].find((element) => element && element.offsetParent !== null) ?? undefined,
    [],
  );
  
  const isDark = mounted && resolvedTheme === 'dark';
  const requestedModuleValue = searchParams.get('module');
  const requestedModule = parseDashboardModule(requestedModuleValue);
  const activeModule = requestedModule && canAccessDashboardModule(requestedModule, user?.role)
    ? requestedModule
    : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!requestedModuleValue) return;

    if (!requestedModule || !canAccessDashboardModule(requestedModule, user?.role)) {
      setModuleNotice(
        requestedModule
          ? 'No tienes permisos para abrir este módulo.'
          : 'El módulo solicitado no existe.',
      );
      router.replace('/dashboard', { scroll: false });
    }
  }, [requestedModule, requestedModuleValue, router, user?.role]);

  useEffect(() => {
    if (!moduleNotice) return;
    const timeout = window.setTimeout(() => setModuleNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [moduleNotice]);

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

  const closeModulePanel = useCallback(() => {
    router.replace('/dashboard', { scroll: false });
  }, [router]);

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

  // Cabecera de escritorio: el mismo reparto, con cinco en línea. Sólo
  // admin (6) y superadmin (7) llegan a tener «Más».
  const desktopOverflowNavItems = navItems.slice(DESKTOP_INLINE_NAV_ITEMS);

  const isNavItemActive = (href: string) => (
    href === '/dashboard'
      ? pathname === '/dashboard' && !activeModule
      : activeModule === getDashboardModuleFromPath(href) || (pathname === href && !activeModule)
  );

  // Menú de usuario de la cabecera móvil. Antes tenía dos ramas según un
  // parámetro que la única llamada fijaba a `true`: se ha eliminado la rama
  // muerta (la del parámetro en `false`) y se ha conservado la que sí se
  // pintaba, arreglando de paso su texto con la codificación rota. El menú de
  // escritorio vive en la propia cabecera de escritorio, más abajo.
  const userMenuDropdown = (avatarClassName?: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={mobileUserMenuRef}
          type="button"
          aria-label="Menú de usuario"
          className="dashboard-mobile-user-trigger cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
        >
          <Avatar className={cn("border border-border/20 shadow-sm", avatarClassName || "h-10 w-10")}>
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-brand-gradient text-white font-black text-xs">
              {getInitials(user?.name || 'U')}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(calc(100vw-24px),16rem)] rounded-2xl" align="end" sideOffset={10} forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none">{user?.name}</p>
            <p className="text-xs font-medium text-muted-foreground capitalize">
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
    </DropdownMenu>
  );

  return (
    <div suppressHydrationWarning className="dashboard-public-page main-container min-h-screen font-sans">
      
      {/* Mobile: Full screen card | Desktop: Max width card with rounded top corners */}
      <div className={cn(
        "dashboard-shell mx-auto w-full relative flex flex-col",
        // `min-h` y no `h`: en escritorio la tarjeta ocupa como mínimo el alto
        // de la ventana —el aspecto de siempre— pero puede crecer con el
        // contenido, que es lo que permite que el scroll lo lleve el
        // documento y la barra siga en el borde de la ventana.
        "lg:max-w-[1440px] lg:min-h-[calc(100vh-4rem)] lg:rounded-[2.5rem] lg:shadow-xl lg:shadow-slate-200/20 dark:lg:shadow-black/20 lg:border lg:border-border/10",
        "h-dvh lg:h-auto"
      )}>
        {/* Top Header Navigation - grid 3 columnas: logo | nav centrado | tools */}
        <header className={cn(
          // Capa propia por debajo del velo de los modales (ver tokens.css).
          "dashboard-desktop-header hidden lg:grid h-20 items-center px-10 border-b border-border/10 shrink-0 transition-all duration-300 z-(--z-header)",
          "bg-linear-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950",
          "lg:rounded-t-[2.5rem]",
          scrolled && "h-16 shadow-lg shadow-black/5"
        )}>
          {/* Left: Logo */}
          <div className="dashboard-desktop-brand-nav flex items-center gap-2">
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
          </div>

          {/* Center: Nav pills */}
          <nav className="dashboard-desktop-nav hidden lg:flex items-center gap-1 justify-center" aria-label="Navegación principal">
            {navItems.map((item, index) => {
              const isActive = isNavItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={getDashboardNavigationHref(item.href)}
                  scroll={item.href === '/dashboard'}
                  onClick={item.href === '/dashboard' ? scrollMainToTop : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold transition-all duration-300",
                    // Entre 1024 y 1279px estos enlaces se ocultan y pasan a «Más».
                    index >= DESKTOP_INLINE_NAV_ITEMS && "is-overflow",
                    isActive
                      ? "bg-brand-gradient text-white shadow-lg shadow-pink-500/20"
                      : "text-muted-foreground hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-500/20"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {desktopOverflowNavItems.length > 0 && (() => {
              // Entre 1024 y 1279px los enlaces de dentro se ocultan con
              // `display: none`, así que su `aria-current` desaparece también
              // del árbol accesible: la sección actual se dice en el nombre
              // del botón, que es lo único que queda en la cabecera.
              const activeOverflowItem = desktopOverflowNavItems.find((item) => isNavItemActive(item.href));
              return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="dashboard-desktop-nav-more"
                    data-active={activeOverflowItem ? 'true' : undefined}
                    aria-label={activeOverflowItem ? `Más secciones — sección actual: ${activeOverflowItem.label}` : 'Más secciones'}
                  >
                    Más <MoreHorizontal aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="w-56 rounded-2xl">
                  {desktopOverflowNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link
                          href={getDashboardNavigationHref(item.href)}
                          scroll={false}
                          aria-current={isNavItemActive(item.href) ? 'page' : undefined}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              );
            })()}
          </nav>

          {/* Right: Search + Notifications + Theme + Avatar */}
          {/* La cabecera entera es `hidden lg:grid`: aquí dentro no hay móvil,
              así que las variantes `md:` que había no hacían nada. */}
          <div className="dashboard-desktop-tools flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              {/* El buscador en línea (256px) sólo cabe desde `2xl`; por debajo
                  se pliega en un icono que abre el mismo SearchModal que usa
                  la barra inferior. */}
              <div className="hidden 2xl:block">
                <HeaderSearch />
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 2xl:hidden"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
              <NotificationsDropdown notificationCount={notificationCount} onCountChange={setNotificationCount} />
              <ThemeToggle />
            </div>

            <div className="flex items-center gap-3 pl-6 border-l border-border/50">
              <div className="dashboard-desktop-user-label text-right">
                <p className="text-sm font-semibold text-foreground leading-tight">{user?.name || 'Usuario'}</p>
                <p className="text-xs font-medium text-muted-foreground capitalize">
                  {getRoleLabel(user?.role)}
                </p>
              </div>
              <DropdownMenu>
                {/* `Avatar` pinta un <span> que no recibe foco: con él como
                    disparador, Configuración, Perfil y Cerrar sesión eran
                    inalcanzables con teclado. */}
                <DropdownMenuTrigger asChild>
                  <button
                    ref={desktopUserMenuRef}
                    type="button"
                    aria-label="Menú de usuario"
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Avatar className="h-10 w-10 border border-border/20 shadow-sm cursor-pointer transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100">
                      <AvatarImage src={user?.avatar_url} />
                      <AvatarFallback className="bg-brand-gradient text-white font-black text-xs">
                        {getInitials(user?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{user?.name}</p>
                      <p className="text-xs font-medium text-muted-foreground capitalize">
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
            <NotificationsDropdown
              notificationCount={notificationCount}
              onCountChange={setNotificationCount}
              triggerClassName="dashboard-mobile-header-action"
              badgeClassName="dashboard-mobile-header-badge"
            />
            {userMenuDropdown("h-10 w-10")}
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

          `@container` implica contención de layout: `<main>` pasa a ser el
          bloque contenedor de cualquier `position: fixed` que cuelgue de él y
          crea un contexto de apilamiento. Hoy no afecta a nada —los modales,
          cajones y paneles se portalean a <body>, y la barra inferior es
          hermana de `<main>`—, pero un elemento fijo escrito dentro de una
          página del dashboard quedaría anclado aquí y por debajo de la
          cabecera. Si hace falta uno, que se portalee.

          `@container`: las páginas de módulo usan variantes de contenedor
          (`@xl:`, `@4xl:`…) y las tablas se apilan según el ancho del
          contenedor (tables.css). Así responden igual aquí que dentro del
          panel de media pantalla, que ya es contenedor.

          Relleno inferior: la barra fija mide 72px + la zona segura; con
          `pb-28` fijo el último elemento quedaba pegado a ella en los iPhone
          con indicador de inicio. `scroll-pb` evita que el foco por teclado
          acabe debajo de la barra. En escritorio el relleno lo fija
          `.dashboard-main` en dashboard-overview.css.
        */}
        <main className="dashboard-main @container flex-1 min-h-0 overflow-y-auto overscroll-y-contain lg:overflow-visible lg:overscroll-auto bg-transparent px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] scroll-pb-[calc(88px+env(safe-area-inset-bottom))] md:px-6 md:pt-6 lg:p-10 lg:scroll-pb-0">
          {children}
        </main>

        <nav className="dashboard-mobile-bottom-bar lg:hidden" aria-label="Navegación principal del dashboard">
          <div className="dashboard-mobile-bottom-scroll">
            {primaryNavItems.map((item) => {
              const moduleId = getDashboardModuleFromPath(item.href);
              const navigationHref = getDashboardNavigationHref(item.href);
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard' && !activeModule
                : activeModule === moduleId || (pathname === item.href && !activeModule);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={navigationHref}
                  scroll={item.href === '/dashboard'}
                  onClick={item.href === '/dashboard' ? scrollMainToTop : undefined}
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
                      overflowNavItems.some((item) => {
                        const moduleId = getDashboardModuleFromPath(item.href);
                        return activeModule === moduleId || item.href === pathname;
                      }) && "is-active"
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
                      <DropdownMenuItem
                        key={item.href}
                        onClick={() => router.push(getDashboardNavigationHref(item.href), { scroll: false })}
                      >
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
        {activeModule && (
          <DashboardModulePanel moduleId={activeModule} onClose={closeModulePanel} />
        )}
        {moduleNotice && (
          <div className="dashboard-module-notice" role="status" aria-live="polite">
            {moduleNotice}
          </div>
        )}
        <UsersPanel
          open={usersPanelOpen}
          onClose={() => setUsersPanelOpen(false)}
          getReturnFocusTarget={getUserMenuTrigger}
        />
        <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
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
