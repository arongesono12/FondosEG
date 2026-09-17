import type { Metadata } from 'next';
import { RoleLandingPage } from '@/components/marketing/landing-page';

export const metadata: Metadata = {
  title: 'Developers | FondosEG',
  description: 'Integra las APIs de FondosEG y construye experiencias financieras rápidas, seguras y escalables. SDK oficial, sandbox y webhooks firmados.',
  openGraph: {
    title: 'Developers | FondosEG',
    description: 'Integra las APIs de FondosEG y construye experiencias financieras rápidas, seguras y escalables.',
    type: 'website',
  },
};

export default function DevelopersLandingPage() {
  return <RoleLandingPage role="developers" />;
}