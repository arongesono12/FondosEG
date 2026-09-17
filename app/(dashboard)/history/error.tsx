'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/layout/error-screen';

export default function HistoryError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { console.error('History error:', error); }, [error]);

  const message = error?.message || '';

  if (message.includes('Unauthorized')) {
    return (
      <ErrorScreen
        badge="401"
        title="Sesión expirada"
        description="Tu sesión venció. Inicia sesión nuevamente para ver el historial."
        actions={[{ href: '/login', label: 'Iniciar sesión' }]}
      />
    );
  }

  return (
    <ErrorScreen
      badge="500"
      title="Error en historial"
      description="No pudimos cargar el historial de operaciones. Intenta nuevamente en unos momentos."
      actions={[
        { href: '/history', label: 'Reintentar' },
        { href: '/dashboard', label: 'Ir al dashboard', variant: 'outline' },
      ]}
    />
  );
}