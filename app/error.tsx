'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Global error boundary:', error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-4xl border border-border/20 bg-card p-8 text-center shadow-2xl">
            <h1 className="text-2xl font-black tracking-tight">Algo salió mal</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
              Se produjo un error inesperado en la aplicación. Intenta recargar la página.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={reset}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-gradient px-5 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition-opacity hover:opacity-90"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}