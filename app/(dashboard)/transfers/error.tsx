'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/layout/error-screen';

export default function TransfersError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { console.error('Transfers error:', error); }, [error]);

  const message = error?.message || '';

  if (message.includes('Unauthorized')) {
    return (
      <ErrorScreen
        badge="401"
        title="Sesión expirada"
        description="Tu sesión venció. Inicia sesión nuevamente para realizar y gestionar transferencias."
        actions={[{ href: '/login', label: 'Iniciar sesión' }]}
      />
    );
  }

  return (
    <ErrorScreen
      badge="500"
      title="Error en transferencias"
      description="No pudimos cargar las transferencias. Intenta nuevamente en unos momentos."
      actions={[
        { href: '/transfers', label: 'Reintentar' },
        { href: '/dashboard', label: 'Ir al dashboard', variant: 'outline' },
      ]}
    />
  );
}