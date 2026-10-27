'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApplicationIconPicker } from '@/components/developers/application-icon';
import { cn } from '@/lib/utils';
import {
  createApiApplication,
  removeApiApplicationIcon,
  updateApiApplication,
  uploadApiApplicationIcon,
} from '@/services/api-applications';
import { createApiKey } from '@/services/api-keys';
import type { ApiApplication, ApiEnvironment, ApiPermission, CreatedApiKeyResponse } from '@/types';

export const PERMISSION_LABELS: Record<ApiPermission, { label: string; detail: string }> = {
  balance: { label: 'Saldo', detail: 'Consultar el saldo de la aplicación.' },
  transfer: { label: 'Envíos', detail: 'Enviar dinero a billeteras de clientes.' },
  history: { label: 'Historial', detail: 'Consultar cobros y envíos.' },
  payments: { label: 'Cobros', detail: 'Cobrar a clientes y vincular billeteras.' },
  properties: { label: 'Propiedades', detail: 'Módulo de alquileres de FondosEG.' },
};

export const PERMISSION_ORDER: ApiPermission[] = ['balance', 'transfer', 'history', 'payments', 'properties'];

const DEFAULT_PERMISSIONS: Record<ApiPermission, boolean> = {
  balance: true,
  transfer: true,
  history: true,
  payments: true,
  properties: false,
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

interface CreateApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `iconError`: la aplicación se creó, pero su icono no se pudo subir. */
  onCreated: (application: ApiApplication, iconError?: string) => void;
}

export function CreateApplicationDialog({ open, onOpenChange, onCreated }: CreateApplicationDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<Blob | null | undefined>(undefined);
  const [iconProcessing, setIconProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDescription('');
    setIcon(undefined);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { application } = await createApiApplication({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // El icono se sube después porque necesita el id. Si falla, la
      // aplicación ya existe: se cierra igualmente para no crearla dos veces.
      let created = application;
      let iconError: string | undefined;
      if (icon instanceof Blob) {
        try {
          const { icon_url } = await uploadApiApplicationIcon(application.id, icon);
          created = { ...application, icon_url };
        } catch (uploadError) {
          iconError = `${application.name} se creó, pero no se pudo subir el icono (${errorMessage(uploadError, 'error desconocido')}). Puedes añadirlo desde Configuración.`;
        }
      }

      onCreated(created, iconError);
      reset();
      onOpenChange(false);
    } catch (createError) {
      setError(errorMessage(createError, 'No se pudo crear la aplicación.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Nueva aplicación</DialogTitle>
          <DialogDescription>
            Cada aplicación tiene su propia billetera, credenciales y webhooks.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="create-application-form" className="space-y-4" onSubmit={handleSubmit}>
            <ApplicationIconPicker
              name={name}
              value={icon}
              onChange={setIcon}
              onProcessingChange={setIconProcessing}
              disabled={saving}
            />
            <div className="space-y-1.5">
              <Label htmlFor="application-name">Nombre</Label>
              <Input
                id="application-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="CasasEG"
                minLength={2}
                maxLength={80}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Es el nombre que verán tus clientes al pagar.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="application-description">Descripción <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea
                id="application-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Cobro de alquileres y liquidación a propietarios"
                maxLength={500}
                className="min-h-20"
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button type="submit" form="create-application-form" disabled={saving || iconProcessing || name.trim().length < 2}>
            {saving ? 'Creando…' : 'Crear aplicación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type ApplicationSettingsPatch = Partial<Pick<ApiApplication, 'name' | 'description' | 'icon_url'>>;

interface ApplicationSettingsDialogProps {
  application: ApiApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Solo los campos guardados: el resto (saldo, estado) puede haber cambiado. */
  onSaved: (applicationId: string, patch: ApplicationSettingsPatch) => void;
}

export function ApplicationSettingsDialog({ application, open, onOpenChange, onSaved }: ApplicationSettingsDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<Blob | null | undefined>(undefined);
  const [iconProcessing, setIconProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada apertura parte de lo guardado. Solo al abrir: un guardado parcial
  // actualiza `application` con el diálogo abierto y no debe borrar el error
  // ni el icono pendiente de reintentar.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current && application) {
      setName(application.name);
      setDescription(application.description ?? '');
      setIcon(undefined);
      setError(null);
    }
    wasOpen.current = open;
  }, [open, application]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) return;
    setSaving(true);
    setError(null);

    const nextName = name.trim();
    const nextDescription = description.trim() || null;
    let patch: ApplicationSettingsPatch = {};

    try {
      if (nextName !== application.name || nextDescription !== application.description) {
        await updateApiApplication(application.id, { name: nextName, description: nextDescription });
        patch = { ...patch, name: nextName, description: nextDescription };
      }

      if (icon instanceof Blob) {
        const { icon_url } = await uploadApiApplicationIcon(application.id, icon);
        patch = { ...patch, icon_url };
      } else if (icon === null && application.icon_url) {
        await removeApiApplicationIcon(application.id);
        patch = { ...patch, icon_url: null };
      }

      onSaved(application.id, patch);
      onOpenChange(false);
    } catch (saveError) {
      // Lo que sí se guardó se refleja ya; el diálogo queda abierto para reintentar.
      if (Object.keys(patch).length > 0) onSaved(application.id, patch);
      setError(errorMessage(saveError, 'No se pudieron guardar los cambios.'));
    } finally {
      setSaving(false);
    }
  }

  const unchanged =
    icon === undefined &&
    name.trim() === application?.name &&
    (description.trim() || null) === (application?.description ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
          <DialogDescription>Así verás e identificarás {application?.name ?? 'la aplicación'} en el portal.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="application-settings-form" className="space-y-4" onSubmit={handleSubmit}>
            <ApplicationIconPicker
              name={name}
              currentUrl={application?.icon_url}
              value={icon}
              onChange={setIcon}
              onProcessingChange={setIconProcessing}
              disabled={saving}
            />
            <div className="space-y-1.5">
              <Label htmlFor="application-settings-name">Nombre</Label>
              <Input
                id="application-settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                required
              />
              <p className="text-xs text-muted-foreground">Es el nombre que verán tus clientes al pagar.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="application-settings-description">Descripción <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea
                id="application-settings-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                className="min-h-20"
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="application-settings-form" disabled={saving || iconProcessing || unchanged || name.trim().length < 2}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateCredentialDialogProps {
  application: ApiApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canIssueProduction: boolean;
  onCreated: (credential: CreatedApiKeyResponse['apiKey']) => void;
}

const ENVIRONMENT_OPTIONS: Array<{ value: ApiEnvironment; label: string; detail: string }> = [
  { value: 'test', label: 'Prueba', detail: 'Respuestas simuladas. No mueve dinero.' },
  { value: 'production', label: 'Producción', detail: 'Opera la billetera real de la aplicación.' },
];

export function CreateCredentialDialog({
  application,
  open,
  onOpenChange,
  canIssueProduction,
  onCreated,
}: CreateCredentialDialogProps) {
  const [environment, setEnvironment] = useState<ApiEnvironment>('test');
  const [permissions, setPermissions] = useState<Record<ApiPermission, boolean>>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEnvironment('test');
    setPermissions(DEFAULT_PERMISSIONS);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) return;
    setSaving(true);
    setError(null);
    try {
      const response = await createApiKey({ application_id: application.id, environment, permissions });
      onCreated(response.apiKey);
      reset();
      onOpenChange(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la credencial.');
    } finally {
      setSaving(false);
    }
  }

  const hasPermission = PERMISSION_ORDER.some((permission) => permissions[permission]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Nueva credencial</DialogTitle>
          <DialogDescription>Para {application?.name ?? 'la aplicación'}.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="create-credential-form" className="space-y-5" onSubmit={handleSubmit}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Entorno</legend>
              <div className="grid gap-2 @sm:grid-cols-2">
                {ENVIRONMENT_OPTIONS.map((option) => {
                  const disabled = option.value === 'production' && !canIssueProduction;
                  const selected = environment === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 transition-colors',
                        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                        disabled && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="radio"
                          name="environment"
                          value={option.value}
                          checked={selected}
                          disabled={disabled}
                          onChange={() => setEnvironment(option.value)}
                          className="accent-pink-600"
                        />
                        {option.label}
                      </span>
                      <span className="pl-5 text-xs text-muted-foreground">
                        {disabled ? 'Solo administración puede emitirla.' : option.detail}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Permisos</legend>
              <div className="divide-y divide-border rounded-xl border border-border">
                {PERMISSION_ORDER.map((permission) => (
                  <label key={permission} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={permissions[permission]}
                      onChange={() => setPermissions((current) => ({ ...current, [permission]: !current[permission] }))}
                      className="h-4 w-4 accent-pink-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{PERMISSION_LABELS[permission].label}</span>
                      <span className="block text-xs text-muted-foreground">{PERMISSION_LABELS[permission].detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="create-credential-form" disabled={saving || !hasPermission}>
            {saving ? 'Creando…' : 'Crear credencial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
