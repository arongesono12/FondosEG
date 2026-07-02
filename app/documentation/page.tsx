import type { Metadata } from 'next';
import { ApiDocumentation } from '@/components/documentation/api-documentation';

export const metadata: Metadata = {
  title: 'Documentación API | FondosEG',
  description: 'Guía oficial para integrar la API de FondosEG: autenticación, endpoints, ejemplos, webhooks y puesta en producción.',
};

export default function DocumentationPage() {
  return <ApiDocumentation />;
}
