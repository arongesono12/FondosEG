import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { PendingApprovalScreen } from '@/components/layout/pending-approval-screen';
import { getOptionalAuthState, getProductAccess } from '@/lib/server/authz';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import { DashboardLayoutWrapper } from '@/components/layout/dashboard-layout-wrapper';
import { AppProvider } from '@/components/providers/app-provider';
import { ensureProductAccessAndBalances } from '@/lib/server/clerk-identity';
import type { User } from '@/types';

// Todo lo que cuelga del dashboard depende de la sesión de Clerk, que se lee
// de las cabeceras de la petición. Sin esto, Next intenta prerenderizar estas
// rutas en tiempo de compilación —donde no hay usuario— y el build falla con
// AuthzError 401.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user: authUser, serviceUnavailable, needsOnboarding } = await getOptionalAuthState();

  if (serviceUnavailable) {
    return <ServiceUnavailableScreen retryHref="/dashboard" />;
  }

  // Identidad válida en Clerk que todavía no existe en la base de datos:
  // primer acceso, tanto por contraseña como por Google.
  if (needsOnboarding) {
    redirect('/onboarding');
  }

  if (!authUser) {
    redirect('/login');
  }

  const adminClient = createAdminClient();
  let dashboardAccess;
  let developerAccess = null;
  let user = null;
  let profileError = null;

  try {
    dashboardAccess = await getProductAccess('dashboard', authUser.id);

    // Autorreparación de un alta a medias: existe el perfil pero no su fila de
    // `account_access`, porque el alta falló entre ambas escrituras. Sin esto
    // el usuario queda encerrado para siempre — /onboarding lo manda al
    // dashboard por tener perfil, y el dashboard a /forbidden por no tener
    // acceso, sin forma de repetir el alta.
    if (!dashboardAccess) {
      const { data: orphanProfile } = await adminClient
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (orphanProfile) {
        const profile = orphanProfile as User;
        console.warn('Perfil sin account_access, reaprovisionando:', profile.id);
        await ensureProductAccessAndBalances(profile);
        dashboardAccess = await getProductAccess('dashboard', authUser.id);
      }
    }

    if (!dashboardAccess || dashboardAccess.status !== 'active') {
      developerAccess = await getProductAccess('developer_portal', authUser.id);
    }

    if (dashboardAccess?.status === 'active') {
      const profileResult = await adminClient
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      user = profileResult.data;
      profileError = profileResult.error;
    }
  } catch (error) {
    if (isAuthServiceUnavailableError(error)) {
      return (
        <ServiceUnavailableScreen
          retryHref="/dashboard"
          description={getAuthErrorMessage(error, 'No pudimos consultar el perfil en Supabase. Intenta nuevamente en unos segundos.')}
        />
      );
    }

    throw error;
  }

  // El registro ya no produce cuentas en espera: se activan al completar el
  // alta. Esta rama cubre el único caso que queda — que un administrador haya
  // puesto la cuenta en 'pending' a mano para retenerla. No es un "prohibido",
  // es un trámite en curso, y decírselo así evita que crea que algo ha fallado.
  if (dashboardAccess?.status === 'pending') {
    return <PendingApprovalScreen role={dashboardAccess.access_role} />;
  }

  if (!dashboardAccess || dashboardAccess.status !== 'active') {
    redirect(developerAccess?.status === 'active' ? '/developer-console' : '/forbidden');
  }

  if (profileError && isAuthServiceUnavailableError(profileError)) {
    return (
      <ServiceUnavailableScreen
        retryHref="/dashboard"
        description={getAuthErrorMessage(profileError, 'No pudimos consultar el perfil en Supabase. Intenta nuevamente en unos segundos.')}
      />
    );
  }

  if (profileError || !user) {
    console.error('No profile found for user:', authUser.id, profileError);
    redirect('/login');
  }

  return (
    <AppProvider initialUser={user}>
      <DashboardLayoutWrapper>
        {children}
      </DashboardLayoutWrapper>
    </AppProvider>
  );
}
