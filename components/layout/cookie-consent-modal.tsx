'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

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

  const content = showConfiguration
    ? {
        title: 'Configura tus cookies',
        description:
          'Las esenciales siempre están activas porque mantienen la sesión, la seguridad y el acceso al dashboard. Las preferencias recuerdan ajustes visuales o configuraciones ligeras.',
      }
    : {
        title: 'Usamos cookies para que FondosEG funcione correctamente',
        description:
          'Guardamos datos pequeños para mantener tu sesión segura, recordar preferencias del dashboard y mejorar la estabilidad. Puedes aceptar todas, rechazar las opcionales o configurar tus preferencias.',
      };

  return (
    <div
      aria-label="Preferencias de cookies"
      role="region"
      className="cookie-consent-toast fixed inset-x-0 bottom-0 z-[70] border-t border-border/20 bg-white/95 px-4 py-4 shadow-[0_-18px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:bg-slate-950/95 dark:shadow-[0_-18px_50px_rgba(0,0,0,0.35)]"
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.preventDefault();
      }}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-3 text-left">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-300">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">{content.title}</p>
            <p className="max-w-3xl text-xs font-medium leading-5 text-muted-foreground">{content.description}</p>
            {!showConfiguration && (
              <Link href="/landing/cookies" className="inline-flex text-xs font-semibold text-primary hover:underline">
                Ver más información sobre cookies
              </Link>
            )}
          </div>
        </div>

        {!showConfiguration ? (
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[520px]">
            <button
              type="button"
              onClick={onRejectOptional}
              className="h-11 rounded-xl border border-border/20 bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
            >
              Rechazar opcionales
            </button>
            <button
              type="button"
              onClick={() => setShowConfiguration(true)}
              className="h-11 rounded-xl border border-border/20 bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
            >
              Configurar
            </button>
            <button
              type="button"
              onClick={onAcceptAll}
              className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Aceptar cookies
            </button>
          </div>
        ) : (
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[520px]">
            <button
              type="button"
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  preferences: !current.preferences,
                }))
              }
              className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${
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
              className="h-11 rounded-xl border border-border/20 bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => onSaveConfiguration(preferences)}
              className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Guardar configuración
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
