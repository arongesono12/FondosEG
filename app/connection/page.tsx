import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';

export default function ConnectionPage() {
  return <ServiceUnavailableScreen retryHref="/dashboard" />;
}
