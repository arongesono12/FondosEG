'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, Briefcase, Check, Loader2, User as UserIcon } from 'lucide-react';

import { completeOnboardingAction } from '@/app/actions/onboarding';
import type { OnboardingInput } from '@/lib/server/clerk-identity';
import { REGISTER_COUNTRIES } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STEPS = ['Tipo de cuenta', 'Datos personales', 'Confirmación'] as const;

const DOCUMENT_LABELS: Record<string, string> = {
  dip: 'DIP',
  nie: 'NIE',
  pasaporte: 'Pasaporte',
};

const ROLE_OPTIONS = [
  {
    value: 'cliente' as const,
    icon: UserIcon,
    title: 'Cliente',
    description: 'Envía y recibe dinero, consulta tu saldo y tu historial de operaciones.',
    note: 'Acceso inmediato',
  },
  {
    value: 'gestor' as const,
    icon: Briefcase,
    title: 'Gestor (Agente)',
    description: 'Opera transferencias para terceros y gestiona un saldo de caja propio.',
    note: 'Acceso inmediato',
  },
];

interface OnboardingFlowProps {
  defaultName: string;
  email: string;
}

export function OnboardingFlow({ defaultName, email }: OnboardingFlowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [data, setData] = useState<OnboardingInput>({
    role: 'cliente',
    name: defaultName,
    phone: '',
    documentType: 'dip',
    documentNumber: '',
    country: '',
    city: '',
  });

  const set = <K extends keyof OnboardingInput>(key: K, value: OnboardingInput[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  // Espeja la validación del servidor para no dejar avanzar en balde.
  const stepTwoComplete =
    data.name.trim().length >= 3 &&
    data.phone.replace(/\D/g, '').length >= 8 &&
    data.documentNumber.trim().length >= 4 &&
    Boolean(data.country) &&
    data.city.trim().length >= 2;

  const goNext = () => {
    setError('');
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  };

  const submit = () => {
    setError('');
    startTransition(async () => {
      const result = await completeOnboardingAction(data);

      if (!result.success) {
        setError(result.error || 'No se pudo completar el alta.');
        // Devuelve al paso donde está el campo que ha fallado.
        if (result.field === 'role') setStep(0);
        else if (result.field) setStep(1);
        return;
      }

      // `refresh()` antes de `push()`: descarta la carga RSC cacheada de
      // /dashboard, que se generó cuando este usuario todavía no tenía perfil
      // y por tanto lleva dentro la redirección a /onboarding. Invertir el
      // orden hace que el usuario rebote al formulario recién completado.
      //
      // La cuenta queda activa sea cual sea el rol, así que el dashboard que
      // se carga a continuación ya es el que corresponde a ese rol.
      router.refresh();
      router.push('/dashboard');
    });
  };

  return (
    <div className="auth-card-premium w-full max-w-xl">
      <div className="auth-card-inner p-6 sm:p-8">
        <ol className="onboarding-steps" aria-label="Progreso del alta">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className="onboarding-step"
              data-state={index === step ? 'current' : index < step ? 'done' : 'todo'}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="onboarding-step-dot" aria-hidden="true">
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="onboarding-step-label">{label}</span>
            </li>
          ))}
        </ol>

        {error && (
          <div role="alert" className="onboarding-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 0 && (
          <fieldset className="onboarding-panel">
            <legend className="auth-title">¿Cómo vas a usar FondosEG?</legend>
            <p className="auth-subtitle">
              Esto define lo que podrás hacer dentro de la plataforma.
            </p>

            <div className="onboarding-roles">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = data.role === option.value;
                return (
                  <label key={option.value} className="onboarding-role" data-selected={selected}>
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={selected}
                      onChange={() => set('role', option.value)}
                      className="sr-only"
                    />
                    <Icon className="onboarding-role-icon" aria-hidden="true" />
                    <span className="onboarding-role-title">{option.title}</span>
                    <span className="onboarding-role-desc">{option.description}</span>
                    <span className="onboarding-role-note">{option.note}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <div className="onboarding-panel">
            <h2 className="auth-title">Tus datos</h2>
            <p className="auth-subtitle">
              Los necesitamos para verificar tu identidad en cada operación.
            </p>

            <div className="onboarding-grid">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ob-name" className="auth-label">Nombre completo</Label>
                <Input
                  id="ob-name"
                  className="auth-input"
                  autoComplete="name"
                  value={data.name}
                  onChange={(event) => set('name', event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ob-phone" className="auth-label">Teléfono</Label>
                <PhoneInput
                  value={data.phone}
                  onChange={(value) => set('phone', value)}
                  placeholder="Número de teléfono"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-doctype" className="auth-label">Tipo de documento</Label>
                <Select value={data.documentType} onValueChange={(value) => set('documentType', value)}>
                  <SelectTrigger id="ob-doctype" className="auth-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-docnum" className="auth-label">Número de documento</Label>
                <Input
                  id="ob-docnum"
                  className="auth-input"
                  placeholder="12345678A"
                  value={data.documentNumber}
                  onChange={(event) => set('documentNumber', event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-country" className="auth-label">País</Label>
                <Select value={data.country} onValueChange={(value) => set('country', value)}>
                  <SelectTrigger id="ob-country" className="auth-input">
                    <SelectValue placeholder="Selecciona un país" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {REGISTER_COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-city" className="auth-label">Ciudad</Label>
                <Input
                  id="ob-city"
                  className="auth-input"
                  autoComplete="address-level2"
                  placeholder="Su ciudad"
                  value={data.city}
                  onChange={(event) => set('city', event.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-panel">
            <h2 className="auth-title">Revisa tus datos</h2>
            <p className="auth-subtitle">
              Comprueba que todo es correcto antes de crear tu cuenta.
            </p>

            <dl className="onboarding-summary">
              <div><dt>Tipo de cuenta</dt><dd>{data.role === 'gestor' ? 'Gestor (Agente)' : 'Cliente'}</dd></div>
              <div><dt>Nombre</dt><dd>{data.name}</dd></div>
              <div>
                <dt>Correo</dt>
                <dd>{email} <span className="onboarding-verified">verificado</span></dd>
              </div>
              <div><dt>Teléfono</dt><dd>{data.phone}</dd></div>
              <div>
                <dt>Documento</dt>
                <dd>{DOCUMENT_LABELS[data.documentType]} · {data.documentNumber}</dd>
              </div>
              <div><dt>País y ciudad</dt><dd>{data.country} · {data.city}</dd></div>
            </dl>

            <p className="onboarding-notice">
              {data.role === 'gestor'
                ? 'Al confirmar entrarás a tu panel de gestor, con tu saldo de caja y las herramientas para operar transferencias.'
                : 'Al confirmar entrarás a tu panel de cliente, listo para enviar y recibir dinero.'}
            </p>
          </div>
        )}

        <div className="onboarding-actions">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack} disabled={isPending}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
          ) : (
            <span />
          )}

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              className="auth-submit"
              onClick={goNext}
              disabled={step === 1 && !stepTwoComplete}
            >
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" className="auth-submit" onClick={submit} disabled={isPending}>
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cuenta...</>
              ) : (
                'Confirmar y crear cuenta'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
