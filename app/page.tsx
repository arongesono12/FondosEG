import { redirect } from 'next/navigation';

import { LandingPage } from '@/components/marketing/landing-page';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { getOptionalAuthState } from '@/lib/server/authz';

export default async function Home() {
  const { user, serviceUnavailable } = await getOptionalAuthState();

  if (serviceUnavailable) {
    return <ServiceUnavailableScreen retryHref="/" />;
  }

  if (user) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
