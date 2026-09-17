import type { Metadata } from 'next';
import { RoleLandingPage } from '@/components/marketing/landing-page';

export const metadata: Metadata = {
  title: 'Aliados | FondosEG',
  description: 'Ofrece servicios financieros a tu red con herramientas simples, seguras y sin complicaciones.',
  openGraph: {
    title: 'Aliados | FondosEG',
    description: 'Ofrece servicios financieros a tu red con herramientas simples, seguras y sin complicaciones.',
    type: 'website',
  },
};

export default function AliadosLandingPage() {
  return <RoleLandingPage role="aliados" />;
}