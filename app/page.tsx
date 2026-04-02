import { redirect } from 'next/navigation';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { getOptionalAuthState } from '@/lib/server/authz';

export default async function Home() {
  const { user, serviceUnavailable } = await getOptionalAuthState();

  if (serviceUnavailable) {
    return <ServiceUnavailableScreen retryHref="/" />;
  }

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
