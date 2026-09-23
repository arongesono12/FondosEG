'use client';

import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Settings, DollarSign, Palette, Bell } from '@/components/ui/hugeicons';
import { useAppStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme-provider';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const currencies = [
  { code: 'XAF', name: 'Franco CFA (XAF)', symbol: 'XAF', flag: '🇨🇲' },
  { code: 'EUR', name: 'Euro (EUR)', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', name: 'Dólar estadounidense (USD)', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', name: 'Libra esterlina (GBP)', symbol: '£', flag: '🇬🇧' },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { preferredCurrency, setPreferredCurrency } = useAppStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [localCurrency, setLocalCurrency] = useState(preferredCurrency);
  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>((resolvedTheme as 'light' | 'dark') || 'dark');
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    setLocalCurrency(preferredCurrency);
    if (resolvedTheme === 'light' || resolvedTheme === 'dark') {
      setLocalTheme(resolvedTheme);
    }
  }, [preferredCurrency, resolvedTheme, open]);

  const handleSave = () => {
    setPreferredCurrency(localCurrency);
    setTheme(localTheme);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="outline-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Settings className="h-5 w-5 text-primary" /> Configuración
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Personaliza tu experiencia en FondosEG
          </DialogDescription>
        </DialogHeader>
        
        <DialogBody className="space-y-6">
          {/* Moneda preferida */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <DollarSign className="h-4 w-4 text-primary" />
              Moneda para envíos
            </label>
            <div className="grid grid-cols-1 gap-2 @xs:grid-cols-2">
              {currencies.map((curr) => (
                <button
                  key={curr.code}
                  type="button"
                  aria-pressed={localCurrency === curr.code}
                  onClick={() => setLocalCurrency(curr.code)}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    localCurrency === curr.code
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-500/20'
                      : 'border-border/20 hover:border-pink-300 dark:hover:border-pink-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{curr.flag}</span>
                    <div>
                      <p className="text-sm font-semibold">{curr.code}</p>
                      <p className="text-xs text-muted-foreground">{curr.name}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tema */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Palette className="h-4 w-4 text-primary" />
              Apariencia
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={localTheme === 'light'}
                onClick={() => setLocalTheme('light')}
                className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                  localTheme === 'light'
                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-500/20'
                    : 'border-border/20 hover:border-pink-300 dark:hover:border-pink-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-white border-2 border-gray-300" />
                  <span className="text-sm font-medium">Claro</span>
                </div>
              </button>
              <button
                type="button"
                aria-pressed={localTheme === 'dark'}
                onClick={() => setLocalTheme('dark')}
                className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                  localTheme === 'dark'
                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-500/20'
                    : 'border-border/20 hover:border-pink-300 dark:hover:border-pink-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-900 border-2 border-gray-700" />
                  <span className="text-sm font-medium">Oscuro</span>
                </div>
              </button>
            </div>
          </div>

          {/* Notificaciones */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Bell className="h-4 w-4 text-primary" />
              Notificaciones
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={notifications}
              onClick={() => setNotifications(!notifications)}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                notifications
                  ? 'border-pink-500 bg-pink-50 dark:bg-pink-500/20'
                  : 'border-border/20'
              }`}
            >
              <span className="text-sm font-medium">Recibir notificaciones</span>
              <div aria-hidden="true" className={`w-12 h-6 shrink-0 rounded-full transition-all motion-reduce:transition-none ${notifications ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${notifications ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </button>
          </div>
        </DialogBody>

        <DialogFooter className="bg-muted/20">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="py-3 px-4 rounded-xl border border-border/20 font-bold text-sm hover:bg-muted/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="py-3 px-4 rounded-xl bg-brand-gradient text-white font-bold text-sm shadow-lg shadow-pink-500/20 hover:scale-[1.02] active:scale-95 transition-all motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
          >
            Guardar cambios
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
