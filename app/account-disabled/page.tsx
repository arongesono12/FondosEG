import { redirect } from 'next/navigation';

import { AccountDisabledScreen } from '@/components/layout/account-disabled-screen';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { getOptionalAuthState } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';

// Depende de la sesión de Clerk y del estado actual de la cuenta.
export const dynamic = 'force-dynamic';

export default async function AccountDisabledPage() {
  const { user, serviceUnavailable } = await getOptionalAuthState();

  if (serviceUnavailable) {
    return <ServiceUnavailableScreen retryHref="/account-disabled" />;
  }

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error } = await createAdminClient()
    .from('users')
    .select('is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('No se pudo comprobar el estado de la cuenta:', error.message);
    return <ServiceUnavailableScreen retryHref="/account-disabled" />;
  }

  // Si administración ya la reactivó, este enlace no debe dejarla atrapada.
  // NULL cuenta como activa (DEFAULT de la columna en filas heredadas).
  if (profile?.is_active !== false) {
    redirect('/dashboard');
  }

  return <AccountDisabledScreen />;
}
