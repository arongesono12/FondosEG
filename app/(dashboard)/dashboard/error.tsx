'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/layout/error-screen';

export default function DashboardPageError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { console.error('Dashboard page error:', error); }, [error]);

  const message = error?.message || '';

  if (message.includes('Unauthorized')) {
    return (
      <ErrorScreen
        badge="401"
        title="Sesión expirada"
        description="Tu sesión venció. Inicia sesión nuevamente para acceder al dashboard."
        actions={[{ href: '/login', label: 'Iniciar sesión' }]}
      />
    );
  }

  return (
    <ErrorScreen
      badge="500"
      title="Error en el dashboard"
      description="No pudimos cargar las métricas. Intenta nuevamente en unos momentos."
      actions={[
        { href: '/dashboard', label: 'Reintentar' },
        { href: '/', label: 'Ir al inicio', variant: 'outline' },
      ]}
    />
  );
}