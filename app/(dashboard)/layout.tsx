import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { PendingApprovalScreen } from '@/components/layout/pending-approval-screen';
import { getOptionalAuthState, getProductAccess } from '@/lib/server/authz';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import { DashboardLayoutWrapper } from '@/components/layout/dashboard-layout-wrapper';
import { AppProvider } from '@/components/providers/app-provider';

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

  // Gestor que ya completó el alta pero espera el visto bueno de un
  // administrador. No es un "prohibido": es un trámite en curso, y decírselo
  // así evita que crea que su cuenta ha fallado.
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
