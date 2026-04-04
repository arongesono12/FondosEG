'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/layout/error-screen';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { isTransientNetworkMessage } from '@/lib/network-errors';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('Global error boundary:', error);
  }, [error]);

  const message = error?.message || '';

  if (isTransientNetworkMessage(message)) {
    return <ServiceUnavailableScreen retryHref="/" />;
  }

  if (message.includes('Unauthorized')) {
    return (
      <ErrorScreen
        badge="401"
        title="No autorizado"
        description="Tu sesión no es válida o no tienes permisos para acceder a esta sección."
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
        title="Operación no permitida"
        description="No tienes permisos para ejecutar esta acción. Si crees que es un error, contacta a administración."
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
      title="Algo salió mal"
      description="Ocurrió un error inesperado. Puedes reintentar o volver al inicio."
      actions={[
        { href: '/', label: 'Ir al inicio' },
        { href: '/dashboard', label: 'Volver al dashboard', variant: 'outline' },
      ]}
    />
  );
}
