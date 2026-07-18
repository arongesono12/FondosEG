import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Code2, LayoutDashboard, LogOut } from 'lucide-react';
import { AppProvider } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOptionalAuthState, getProductAccess } from '@/lib/server/authz';
import type { User } from '@/types';

export default async function DeveloperConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user: authUser, serviceUnavailable } = await getOptionalAuthState();
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
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <Link href="/developer-console" className="flex items-center gap-2 font-semibold">
              <Code2 className="h-5 w-5 text-pink-500" /> Portal de desarrolladores
            </Link>
            <div className="flex items-center gap-2">
              {dashboardAccess?.status === 'active' && (
                <Button variant="outline" size="sm" asChild><Link href="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link></Button>
              )}
              <Button variant="ghost" size="sm" asChild><Link href="/force-signout"><LogOut className="mr-2 h-4 w-4" />Salir</Link></Button>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </AppProvider>
  );
}
