import { redirect } from 'next/navigation';

import { OnboardingFlow } from '@/components/auth/onboarding-flow';
import { getClerkIdentity, resolveInternalUser } from '@/lib/server/clerk-identity';

// Depende de la sesión: nunca se prerenderiza.
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const identity = await getClerkIdentity();

  // Sin identidad de Clerk no hay nada que dar de alta.
  if (!identity) redirect('/login');

  // Si ya tiene perfil, el alta está hecha: no debe poder volver aquí.
  const existing = await resolveInternalUser(identity);
  if (existing) redirect('/dashboard');

  return (
    <div className="auth-screen">
      <OnboardingFlow defaultName={identity.name} email={identity.email} />
    </div>
  );
}
