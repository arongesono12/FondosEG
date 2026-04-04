'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/layout/error-screen';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';

function isConnectionError(message: string) {
  const token = message.toLowerCase();
  return token.includes('fetch failed') || token.includes('timeout') || token.includes('service unavailable');
}

export default function DashboardError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('Dashboard error boundary:', error);
  }, [error]);

  const message = error?.message || '';

  if (isConnectionError(message)) {
    return <ServiceUnavailableScreen retryHref="/dashboard" />;
  }

  if (message.includes('Unauthorized')) {
    return (
      <ErrorScreen
        badge="401"
        title="No autorizado"
        description="Tu sesión expiró o no tienes permisos para acceder a esta sección del dashboard."
        actions={[
          { href: '/login', label: 'Iniciar sesión' },
          { href: '/', label: 'Ir al inicio', variant: 'outline' },
        ]}
      />
    );
  }

  if (message.includes('Forbidden') || message.includes('Account disabled')) {
    return (
      <ErrorScreen
        badge="403"
        title="Operación indebida"
        description="No estás autorizado para realizar esta operación. Si necesitas acceso, contacta a administración."
        actions={[
          { href: '/dashboard', label: 'Volver al dashboard' },
          { href: '/login', label: 'Cambiar cuenta', variant: 'outline' },
        ]}
      />
    );
  }

  return (
    <ErrorScreen
      badge="500"
      title="Error inesperado"
      description="Se produjo un error en el dashboard. Intenta de nuevo o vuelve al inicio."
      actions={[
        { href: '/dashboard', label: 'Ir al dashboard' },
        { href: '/', label: 'Ir al inicio', variant: 'outline' },
      ]}
    />
  );
}
