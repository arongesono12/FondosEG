'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/layout/error-screen';

export default function BalanceError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { console.error('Balance error:', error); }, [error]);

  const message = error?.message || '';

  if (message.includes('Unauthorized')) {
    return (
      <ErrorScreen
        badge="401"
        title="Sesión expirada"
        description="Tu sesión venció. Inicia sesión nuevamente para consultar tus saldos."
        actions={[{ href: '/login', label: 'Iniciar sesión' }]}
      />
    );
  }

  return (
    <ErrorScreen
      badge="500"
      title="Error en saldos"
      description="No pudimos cargar tus saldos. Intenta nuevamente en unos momentos."
      actions={[
        { href: '/balance', label: 'Reintentar' },
        { href: '/dashboard', label: 'Ir al dashboard', variant: 'outline' },
      ]}
    />
  );
}