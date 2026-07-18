import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { getOptionalAuthState, getProductAccess } from '@/lib/server/authz';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import { DashboardLayoutWrapper } from '@/components/layout/dashboard-layout-wrapper';
import { AppProvider } from '@/components/providers/app-provider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user: authUser, serviceUnavailable } = await getOptionalAuthState();

  if (serviceUnavailable) {
    return <ServiceUnavailableScreen retryHref="/dashboard" />;
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
