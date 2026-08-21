'use client';

import { useEffect, useRef } from 'react';
import { useClerk } from '@clerk/nextjs';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Salida de emergencia: cierra la sesión de Clerk y devuelve al login.
 * Sirve como escape cuando el shell del dashboard queda en un estado
 * inconsistente y el usuario no encuentra el botón de salir.
 */
export default function ForceSignOutPage() {
  const { signOut } = useClerk();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void signOut({ redirectUrl: '/login' });
  }, [signOut]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="p-8 text-center space-y-4">
        <Skeleton className="mx-auto h-12 w-12 rounded-2xl" />
        <Skeleton className="mx-auto h-7 w-56 rounded-xl" />
        <Skeleton className="mx-auto h-4 w-80 max-w-full rounded-xl" />
        <Skeleton className="mx-auto h-10 w-40 rounded-2xl" />
      </div>
    </div>
  );
}
