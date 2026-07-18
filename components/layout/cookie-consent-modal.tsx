'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Cookie,
  Save,
  Settings2,
  ShieldCheck,
} from 'lucide-react';

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
        title: 'Elige tus preferencias',
        description:
          'Las cookies esenciales siempre están activas. Tú decides si permites las que recuerdan ajustes visuales y preferencias de uso.',
      }
    : {
        title: 'Tu privacidad, bajo tu control',
        description:
          'Usamos cookies esenciales para mantener FondosEG seguro y, con tu permiso, cookies de preferencias para recordar cómo usas la plataforma.',
      };

  const secondaryButton =
    'cookie-consent-secondary flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:bg-muted/60 active:translate-y-0';

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
                Consulta nuestra política de cookies
              </Link>
            )}
          </div>
        </div>

        {!showConfiguration ? (
          <div className="cookie-consent-actions grid w-full grid-cols-3 gap-2.5 lg:w-[520px]">
            <button
              type="button"
              onClick={onAcceptAll}
              className="cookie-consent-primary flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pink-500/25 active:translate-y-0"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Aceptar todas
            </button>
            <button type="button" onClick={onRejectOptional} className={secondaryButton}>
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Esenciales
            </button>
            <button type="button" onClick={() => setShowConfiguration(true)} className={secondaryButton}>
              <Settings2 className="h-4 w-4 text-primary" aria-hidden="true" />
              Personalizar
            </button>
          </div>
        ) : (
          <div className="cookie-consent-actions grid w-full grid-cols-3 gap-2.5 lg:w-[520px]">
            <button
              type="button"
              aria-pressed={preferences.preferences}
              onClick={() => setPreferences((current) => ({ ...current, preferences: !current.preferences }))}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-center text-sm font-semibold transition-all ${
                preferences.preferences
                  ? 'border-pink-500/60 bg-pink-50 text-pink-800 shadow-sm shadow-pink-500/10 dark:bg-pink-500/10 dark:text-pink-100'
                  : 'border-border/60 bg-background/70 text-foreground hover:bg-muted/60'
              }`}
            >
              <Cookie className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Preferencias</span>
              <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${preferences.preferences ? 'bg-pink-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                {preferences.preferences && <Check className="h-3 w-3" aria-hidden="true" />}
                {preferences.preferences ? 'Activadas' : 'Desactivadas'}
              </span>
            </button>
            <button type="button" onClick={() => setShowConfiguration(false)} className={secondaryButton}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
            </button>
            <button
              type="button"
              onClick={() => onSaveConfiguration(preferences)}
              className="cookie-consent-primary flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
            >
              <Save className="h-4 w-4" aria-hidden="true" /> Guardar preferencias
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
