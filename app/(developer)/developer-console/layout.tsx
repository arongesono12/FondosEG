import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Code2, LayoutDashboard, LogOut } from '@/components/ui/hugeicons';
import { AppProvider } from '@/components/providers/app-provider';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOptionalAuthState, getProductAccess } from '@/lib/server/authz';
import type { User } from '@/types';

// Misma razón que en el dashboard: la consola exige sesión en cada petición.
export const dynamic = 'force-dynamic';

export default async function DeveloperConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user: authUser, serviceUnavailable, needsOnboarding } = await getOptionalAuthState();

  // Identidad de Clerk sin perfil interno: primero completa el alta guiada.
  if (needsOnboarding) {
    redirect('/onboarding');
  }
  if (serviceUnavailable) redirect('/developers-portal/login?error=service');
  if (!authUser) redirect('/developers-portal/login');

  const access = await getProductAccess('developer_portal', authUser.id);
  if (!access || access.status !== 'active') redirect('/forbidden');

  const admin = createAdminClient();
  const [{ data: developer }, dashboardAccess] = await Promise.all([
    admin.from('developer_profiles').select('name,email,phone,country,city,created_at,updated_at').eq('user_id', authUser.id).maybeSingle(),
    getProductAccess('dashboard', authUser.id),
  ]);
  const now = new Date().toISOString();
  const consoleUser: User = {
    id: authUser.id,
    name: developer?.name || authUser.user_metadata?.name || authUser.email || 'Desarrollador',
    email: developer?.email || authUser.email || '',
    phone: developer?.phone || '',
    role: access.access_role === 'admin' || access.access_role === 'superadmin' ? access.access_role : 'cliente',
    country: developer?.country || undefined,
    city: developer?.city || undefined,
    is_active: true,
    created_at: developer?.created_at || now,
    updated_at: developer?.updated_at || now,
  };

  return (
    <AppProvider initialUser={consoleUser}>
      <div suppressHydrationWarning className="dashboard-public-page main-container min-h-screen font-sans">
        <div className="dashboard-shell mx-auto w-full relative flex flex-col lg:max-w-[1440px] lg:min-h-[calc(100vh-4rem)] lg:rounded-[2.5rem] lg:shadow-xl lg:shadow-slate-200/20 dark:lg:shadow-black/20 lg:border lg:border-border/10 h-dvh lg:h-auto">
          {/* Desktop header */}
          <header className="dashboard-desktop-header hidden lg:grid h-20 items-center px-10 border-b border-border/10 shrink-0 transition-all duration-300 z-50 bg-linear-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 lg:rounded-t-[2.5rem]">
            <div className="dashboard-desktop-brand-nav flex items-center gap-2">
              <Link href="/developer-console" className="flex items-center gap-2">
                <DashboardLogo size="md" labelClassName="text-xl md:text-2xl" />
              </Link>
            </div>

            <nav className="dashboard-desktop-nav hidden lg:flex items-center gap-1 justify-center" aria-label="Navegación principal">
              <Link href="/developer-console" aria-current="page">
                <Code2 className="h-4 w-4" /> Portal
              </Link>
              {dashboardAccess?.status === 'active' && (
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
              )}
            </nav>

            <div className="dashboard-desktop-tools flex items-center gap-1 md:gap-4">
              <ThemeToggle />
              <Button variant="outline" size="sm" asChild>
                <Link href="/force-signout"><LogOut className="mr-2 h-4 w-4" />Salir</Link>
              </Button>
            </div>
          </header>

          {/* Mobile header */}
          <header className="dashboard-mobile-header lg:hidden">
            <Link href="/developer-console" className="dashboard-mobile-brand" aria-label="FondosEG portal de desarrolladores">
              <DashboardLogo size="sm" labelClassName="text-lg" />
            </Link>
            <div className="dashboard-mobile-header-actions">
              <ThemeToggle />
              <Link href="/force-signout" aria-label="Cerrar sesión" className="dashboard-mobile-header-action">
                <LogOut className="h-5 w-5" />
              </Link>
            </div>
          </header>

          <main className="dashboard-main flex-1 min-h-0 overflow-y-auto overscroll-y-contain lg:overflow-visible lg:overscroll-auto bg-transparent p-4 pb-28 lg:p-10">
            {children}
          </main>
        </div>
      </div>
    </AppProvider>
  );
}