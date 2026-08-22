'use server';

import { revalidatePath } from 'next/cache';

import {
  completeOnboarding,
  getClerkIdentity,
  resolveInternalUser,
  type OnboardingInput,
} from '@/lib/server/clerk-identity';
import { REGISTER_COUNTRIES } from '@/lib/countries';

const DOCUMENT_TYPES = ['dip', 'nie', 'pasaporte'] as const;

export interface OnboardingResult {
  success: boolean;
  error?: string;
  /** Campo que ha fallado, para que el formulario devuelva al paso correcto. */
  field?: keyof OnboardingInput;
}

/**
 * Valida en servidor lo mismo que el formulario valida en cliente. La
 * validación de cliente es comodidad; ésta es la que cuenta, porque la acción
 * es invocable directamente.
 */
function validate(input: OnboardingInput): { field: keyof OnboardingInput; error: string } | null {
  if (input.role !== 'cliente' && input.role !== 'gestor') {
    return { field: 'role', error: 'Selecciona un tipo de cuenta válido.' };
  }
  if (input.name.trim().length < 3) {
    return { field: 'name', error: 'Escribe tu nombre completo (mínimo 3 caracteres).' };
  }
  // Se exigen dígitos reales: el selector de país deja "+240" por sí solo,
  // que pasaría un simple control de longitud sin ser un teléfono.
  if (input.phone.replace(/\D/g, '').length < 8) {
    return { field: 'phone', error: 'Introduce un número de teléfono válido.' };
  }
  if (!DOCUMENT_TYPES.includes(input.documentType as (typeof DOCUMENT_TYPES)[number])) {
    return { field: 'documentType', error: 'Selecciona un tipo de documento válido.' };
  }
  if (input.documentNumber.trim().length < 4) {
    return { field: 'documentNumber', error: 'Introduce el número de tu documento.' };
  }
  // REGISTER_COUNTRIES es una tupla de literales; se ensancha a string[] para
  // poder comprobar un valor arbitrario que llega del cliente.
  if (!(REGISTER_COUNTRIES as readonly string[]).includes(input.country)) {
    return { field: 'country', error: 'Selecciona un país de la lista.' };
  }
  if (input.city.trim().length < 2) {
    return { field: 'city', error: 'Introduce tu ciudad.' };
  }
  return null;
}

/**
 * Invalida el árbol de layouts tras crear el perfil.
 *
 * Sin esto, `router.push('/dashboard')` sirve la carga RSC que se generó ANTES
 * del alta —cuando el layout aún resolvía `needsOnboarding` y redirigía a
 * `/onboarding`—, y el usuario rebota al formulario que acaba de completar.
 * Se invalida el layout raíz porque el estado de sesión afecta a todas las
 * ramas, no sólo al dashboard.
 */
function revalidateAuthenticatedTree() {
  revalidatePath('/', 'layout');
}

export async function completeOnboardingAction(input: OnboardingInput): Promise<OnboardingResult> {
  const identity = await getClerkIdentity();
  if (!identity) {
    return { success: false, error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' };
  }

  const existing = await resolveInternalUser(identity);
  if (existing) {
    // Ya tenía perfil (doble envío, o cuenta anterior a Clerk reconectada).
    revalidateAuthenticatedTree();
    return { success: true };
  }

  const invalid = validate(input);
  if (invalid) {
    return { success: false, error: invalid.error, field: invalid.field };
  }

  try {
    await completeOnboarding(identity, input);
    revalidateAuthenticatedTree();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('teléfono')) {
      return { success: false, error: message, field: 'phone' };
    }
    console.error('Fallo al completar el alta guiada:', message);
    return {
      success: false,
      error: 'No se pudo crear tu cuenta. Inténtalo de nuevo en unos segundos.',
    };
  }
}
