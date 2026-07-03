'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface CookieConsentPreferences {
  essential: true;
  preferences: boolean;
}

interface CookieConsentModalProps {
  open: boolean;
  initialPreferences: CookieConsentPreferences;
  onAcceptAll: () => void;
  onRejectOptional: () => void;
  onSaveConfiguration: (preferences: CookieConsentPreferences) => void;
}

export function CookieConsentModal({
  open,
  initialPreferences,
  onAcceptAll,
  onRejectOptional,
  onSaveConfiguration,
}: CookieConsentModalProps) {
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [preferences, setPreferences] = useState<CookieConsentPreferences>(initialPreferences);

  useEffect(() => {
    if (open) {
      setShowConfiguration(false);
      setPreferences(initialPreferences);
    }
  }, [initialPreferences, open]);

  if (!open) return null;

  return (
    <div
      aria-label="Preferencias de cookies"
      role="region"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-border/20 bg-white/95 px-3 py-3 shadow-[0_-18px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:bg-slate-950/95 dark:shadow-[0_-18px_50px_rgba(0,0,0,0.35)]"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
        }
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {!showConfiguration ? (
          <>
            <div className="min-w-0 space-y-1 text-left">
              <p className="text-sm font-black text-foreground">Usamos cookies para que FondosEG funcione correctamente</p>
              <p className="max-w-3xl text-xs font-semibold leading-5 text-muted-foreground">
                Las cookies son pequeños datos que el navegador guarda para mantener tu sesión segura, recordar preferencias del dashboard y mejorar la estabilidad de la aplicación. Puedes aceptar todas, rechazar las opcionales o configurar tus preferencias.
              </p>
              <Link href="/landing/cookies" className="inline-flex text-xs font-black text-primary hover:underline">
                Ver más información sobre cookies
              </Link>
            </div>
            <div className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 md:w-auto md:justify-end md:overflow-visible md:pb-0">
              <button
                type="button"
                onClick={onRejectOptional}
                className="h-11 shrink-0 rounded-xl border border-border/20 bg-background px-4 text-sm font-black text-foreground transition-colors hover:bg-muted/60"
              >
                Rechazar opcionales
              </button>
              <button
                type="button"
                onClick={() => setShowConfiguration(true)}
                className="h-11 shrink-0 rounded-xl border border-border/20 bg-background px-4 text-sm font-black text-foreground transition-colors hover:bg-muted/60"
              >
                Configurar
              </button>
              <button
                type="button"
                onClick={onAcceptAll}
                className="h-11 shrink-0 rounded-xl bg-brand-gradient px-5 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Aceptar cookies
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 space-y-1 text-left">
              <p className="text-sm font-black text-foreground">Configura tus cookies</p>
              <p className="max-w-3xl text-xs font-semibold leading-5 text-muted-foreground">
                Las cookies esenciales siempre están activas porque mantienen la sesión, la seguridad y el acceso al dashboard. Las cookies de preferencias ayudan a recordar ajustes visuales o configuraciones ligeras.
              </p>
            </div>
            <div className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 md:w-auto md:justify-end md:overflow-visible md:pb-0">
              <button
                type="button"
                onClick={() =>
                  setPreferences((current) => ({
                    ...current,
                    preferences: !current.preferences,
                  }))
                }
                className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition-colors ${
                  preferences.preferences
                    ? 'border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-200'
                    : 'border-border/20 bg-background text-foreground hover:bg-muted/60'
                }`}
              >
                Preferencias {preferences.preferences ? 'activadas' : 'desactivadas'}
              </button>
              <button
                type="button"
                onClick={() => setShowConfiguration(false)}
                className="h-11 shrink-0 rounded-xl border border-border/20 bg-background px-4 text-sm font-black text-foreground transition-colors hover:bg-muted/60"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => onSaveConfiguration(preferences)}
                className="h-11 shrink-0 rounded-xl bg-brand-gradient px-5 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Guardar configuracion
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
