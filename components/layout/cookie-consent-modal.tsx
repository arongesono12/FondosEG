'use client';

import { useEffect, useState } from 'react';
import { Cookie, Settings2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="[&>button]:hidden max-w-xl overflow-hidden border border-white/25 bg-white/95 p-0 shadow-2xl shadow-black/20 outline-none backdrop-blur-none dark:border-white/10 dark:bg-[#10131c]/95"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="border-b border-border/10 bg-linear-to-br from-rose-50 via-white to-pink-50 p-6 dark:from-slate-900 dark:via-[#10131c] dark:to-slate-900">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-pink-500/20">
              <Cookie className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-black text-foreground">
              Bienvenido al dashboard
            </DialogTitle>
            <DialogDescription className="max-w-lg text-sm font-medium leading-6 text-muted-foreground">
              Usamos cookies esenciales para mantener la sesión segura y cookies de preferencias para recordar ajustes como la moneda o ciertas configuraciones del panel. Puedes aceptar todas, rechazar las opcionales o configurarlas ahora.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-border/10 bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div className="space-y-1">
                <p className="text-sm font-black text-foreground">Cookies esenciales</p>
                <p className="text-sm font-medium leading-6 text-muted-foreground">
                  Son obligatorias para autenticar la sesión, proteger el acceso y permitir el funcionamiento básico del dashboard. Siempre estarán activas.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/10 bg-muted/20 p-4">
            <button
              type="button"
              onClick={() => setShowConfiguration((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex items-start gap-3">
                <Settings2 className="mt-0.5 h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-black text-foreground">Cookies de preferencias</p>
                  <p className="text-sm font-medium leading-6 text-muted-foreground">
                    Guardan ajustes del usuario para ofrecer una experiencia más cómoda y consistente dentro del panel.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                {showConfiguration ? 'Ocultar' : 'Configurar'}
              </span>
            </button>

            {showConfiguration && (
              <div className="mt-4 rounded-2xl border border-border/10 bg-background/80 p-4">
                <button
                  type="button"
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      preferences: !current.preferences,
                    }))
                  }
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                    preferences.preferences
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-500/10'
                      : 'border-border/20 bg-background'
                  }`}
                >
                  <div>
                    <p className="text-sm font-black text-foreground">Recordar preferencias del dashboard</p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Tema, moneda preferida y configuraciones ligeras del panel.
                    </p>
                  </div>
                  <div
                    className={`h-6 w-12 rounded-full transition-all ${
                      preferences.preferences ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        preferences.preferences ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSaveConfiguration(preferences)}
                  className="mt-4 w-full rounded-xl bg-brand-gradient px-4 py-3 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  Guardar configuración
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/10 bg-muted/10 p-4 sm:flex-row">
          <button
            type="button"
            onClick={onRejectOptional}
            className="flex-1 rounded-xl border border-border/20 px-4 py-3 text-sm font-black text-foreground transition-colors hover:bg-muted/50"
          >
            Rechazar opcionales
          </button>
          <button
            type="button"
            onClick={() => setShowConfiguration(true)}
            className="flex-1 rounded-xl border border-border/20 px-4 py-3 text-sm font-black text-foreground transition-colors hover:bg-muted/50"
          >
            Configurar
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="flex-1 rounded-xl bg-brand-gradient px-4 py-3 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            Aceptar cookies
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
