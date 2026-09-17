import type { Metadata } from 'next';
import { RoleLandingPage } from '@/components/marketing/landing-page';

export const metadata: Metadata = {
  title: 'Gestores | FondosEG',
  description: 'Control total para quienes mueven el dinero: administra operaciones, billeteras, comisiones y el rendimiento de tu red en un solo lugar.',
  openGraph: {
    title: 'Gestores | FondosEG',
    description: 'Administra operaciones, controla billeteras, comisiones y rendimiento de tu red en un solo lugar.',
    type: 'website',
  },
};

export default function GestoresLandingPage() {
  return <RoleLandingPage role="gestores" />;
}