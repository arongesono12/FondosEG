import 'server-only';

import { currentUser } from '@clerk/nextjs/server';
import type { User as ClerkUser } from '@clerk/nextjs/server';

import { createAdminClient } from '@/lib/supabase/admin';
import type { User, UserRole } from '@/types';

/**
 * Puente entre la identidad de Clerk y el UUID interno de `public.users`.
 *
 * Clerk es la fuente de verdad de QUIÉN eres (email verificado, contraseña,
 * MFA, OAuth). Supabase sigue siendo la fuente de verdad de QUÉ eres dentro de
 * FondosEG (rol, saldos, accesos por producto).
 *
 * El aprovisionamiento es *just-in-time*: la fila de `public.users` se crea en
 * la primera petición autenticada, no durante el registro. Eso elimina de raíz
 * los fallos del flujo anterior — registros abandonados que bloqueaban el
 * correo para siempre, perfiles huérfanos y el trigger `on_auth_user_created`
 * abortando el alta entera por una colisión de teléfono.
 */

export interface ClerkIdentity {
  clerkUserId: string;
  email: string;
  name: string;
  imageUrl: string | null;
}

/**
 * Datos que el usuario aporta durante el alta guiada. `role` sale del paso 1,
 * el resto del paso 2.
 */
export interface OnboardingInput {
  role: Extract<UserRole, 'cliente' | 'gestor'>;
  name: string;
  phone: string;
  documentType: string;
  documentNumber: string;
  country: string;
  city: string;
}

/**
 * El alta guiada activa la cuenta directamente, sea cual sea el rol elegido:
 * el usuario entra a su dashboard y opera según ese rol sin pasos intermedios.
 *
 * `account_access.status` sigue admitiendo 'pending' y 'suspended' para que un
 * administrador pueda retener o bloquear una cuenta desde la base de datos —
 * el layout del dashboard lo respeta— pero el registro ya no los produce.
 */

function primaryEmail(clerkUser: ClerkUser): string | null {
  const primary = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId
  );
  const chosen = primary ?? clerkUser.emailAddresses[0];
  return chosen?.emailAddress?.toLowerCase().trim() ?? null;
}

function displayName(clerkUser: ClerkUser, fallbackEmail: string): string {
  const fromParts = [clerkUser.firstName, clerkUser.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();

  if (fromParts) return fromParts;
  if (clerkUser.username?.trim()) return clerkUser.username.trim();
  return fallbackEmail.split('@')[0] || 'Usuario';
}

/**
 * Lee el rol declarado en los metadatos públicos de Clerk, si lo hay.
 * Permite promover a `gestor`/`admin` desde el dashboard de Clerk sin tocar la
 * base de datos. Nunca se lee de `unsafeMetadata`, que el cliente puede editar.
 */
function roleFromClerk(clerkUser: ClerkUser): UserRole | null {
  const declared = (clerkUser.publicMetadata as Record<string, unknown> | null)?.role;
  if (
    declared === 'admin' ||
    declared === 'superadmin' ||
    declared === 'gestor' ||
    declared === 'cliente'
  ) {
    return declared;
  }
  return null;
}

export async function getClerkIdentity(): Promise<ClerkIdentity | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = primaryEmail(clerkUser);
  if (!email) return null;

  return {
    clerkUserId: clerkUser.id,
    email,
    name: displayName(clerkUser, email),
    imageUrl: clerkUser.imageUrl || null,
  };
}

/**
 * Resuelve la identidad de Clerk a la fila interna de `public.users`.
 *
 * Orden de resolución:
 *   1. Por `clerk_user_id` — el caso normal a partir del segundo acceso.
 *   2. Por `email` — reconecta cuentas que ya existían antes de migrar a Clerk,
 *      preservando su UUID, su rol, sus saldos y todo su histórico. Estas
 *      cuentas NO pasan por el alta guiada: sus datos ya están completos.
 *   3. `null` — identidad válida en Clerk que nunca ha existido en la base de
 *      datos. El llamante debe enviarla al alta guiada (`/onboarding`).
 *
 * Deliberadamente ya NO crea la fila por su cuenta: el rol y los datos
 * personales los aporta el usuario, no un valor por defecto.
 */
export async function resolveInternalUser(identity: ClerkIdentity): Promise<User | null> {
  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: byClerkId, error: byClerkIdError } = await adminClient
    .from('users')
    .select('*')
    .eq('clerk_user_id', identity.clerkUserId)
    .maybeSingle();

  if (byClerkIdError) throw new Error(byClerkIdError.message);
  if (byClerkId) return byClerkId as User;

  // Cuenta preexistente de la era Supabase Auth: la reclamamos por correo.
  const { data: byEmail, error: byEmailError } = await adminClient
    .from('users')
    .select('*')
    .eq('email', identity.email)
    .maybeSingle();

  if (byEmailError) throw new Error(byEmailError.message);

  if (byEmail) {
    const { data: linked, error: linkError } = await adminClient
      .from('users')
      .update({
        clerk_user_id: identity.clerkUserId,
        is_verified: true,
        updated_at: nowIso,
      })
      .eq('id', (byEmail as User).id)
      .select('*')
      .single();

    if (linkError) throw new Error(linkError.message);
    return linked as User;
  }

  // Identidad nueva: aún no es nadie dentro de FondosEG.
  return null;
}

/**
 * Cierra el alta guiada: crea la fila de `public.users` con lo que el usuario
 * ha declarado y le concede el acceso que le corresponda por rol.
 *
 * Es idempotente frente a un doble envío del formulario: si la fila ya existe
 * para esta identidad, la devuelve en lugar de duplicarla.
 */
export async function completeOnboarding(
  identity: ClerkIdentity,
  input: OnboardingInput
): Promise<User> {
  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  const existing = await resolveInternalUser(identity);
  if (existing) return existing;

  const phone = input.phone.trim() || null;

  // El teléfono es único entre usuarios. Comprobarlo antes da un mensaje
  // legible en vez del error crudo del índice.
  if (phone) {
    const { data: phoneOwner, error: phoneError } = await adminClient
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();
    if (phoneError) throw new Error(phoneError.message);
    if (phoneOwner) {
      throw new Error('Ya existe una cuenta registrada con este número de teléfono.');
    }
  }

  const { data: created, error: createError } = await adminClient
    .from('users')
    .insert({
      clerk_user_id: identity.clerkUserId,
      name: input.name.trim(),
      email: identity.email,
      phone,
      role: input.role,
      document_type: input.documentType || null,
      document_number: input.documentNumber.trim() || null,
      country: input.country || null,
      city: input.city.trim() || null,
      avatar_url: identity.imageUrl,
      is_active: true,
      // El correo llega verificado por Clerk en ambos flujos, contraseña y
      // Google, así que no hay una segunda verificación que hacer aquí.
      is_verified: true,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (createError) {
    // Carrera entre dos envíos concurrentes: la otra petición ya creó la fila.
    const { data: raced } = await adminClient
      .from('users')
      .select('*')
      .eq('clerk_user_id', identity.clerkUserId)
      .maybeSingle();
    if (raced) return raced as User;
    throw new Error(createError.message);
  }

  const user = created as User;
  await ensureProductAccessAndBalances(user);
  return user;
}

/**
 * Garantiza el acceso al dashboard y las filas de saldo que el resto de la
 * aplicación da por hechas para cada rol.
 */
export async function ensureProductAccessAndBalances(user: User): Promise<void> {
  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  const { error: accessError } = await adminClient.from('account_access').upsert(
    {
      user_id: user.id,
      product: 'dashboard',
      access_role: user.role,
      status: 'active',
      updated_at: nowIso,
    },
    { onConflict: 'user_id,product' }
  );
  if (accessError) throw new Error(accessError.message);

  if (user.role === 'admin' || user.role === 'superadmin') {
    const { error: developerAccessError } = await adminClient.from('account_access').upsert(
      {
        user_id: user.id,
        product: 'developer_portal',
        access_role: user.role,
        status: 'active',
        updated_at: nowIso,
      },
      { onConflict: 'user_id,product' }
    );
    if (developerAccessError) throw new Error(developerAccessError.message);
  }

  if (user.role === 'gestor') {
    const { error: balanceError } = await adminClient.from('agent_balances').upsert(
      { agent_id: user.id, balance: 0, cash_balance: 0, currency: 'XAF', updated_at: nowIso },
      { onConflict: 'agent_id' }
    );
    if (balanceError) throw new Error(balanceError.message);
  }

  if (user.role === 'cliente') {
    const { error: balanceError } = await adminClient.from('client_balances').upsert(
      { client_id: user.id, balance: 0, currency: 'XAF', updated_at: nowIso },
      { onConflict: 'client_id' }
    );
    if (balanceError) throw new Error(balanceError.message);
  }
}

/**
 * Sincroniza hacia la base de datos lo que el usuario haya cambiado en Clerk
 * (nombre, correo, avatar) y aplica el rol declarado en `publicMetadata`.
 * Se llama en cada resolución de perfil: es un único UPDATE y mantiene el
 * dashboard alineado con Clerk sin necesidad de webhooks.
 */
export async function syncFromClerk(user: User, identity: ClerkIdentity): Promise<User> {
  const clerkUser = await currentUser();
  const declaredRole = clerkUser ? roleFromClerk(clerkUser) : null;

  const changes: Record<string, unknown> = {};
  if (user.email !== identity.email) changes.email = identity.email;
  if (user.name !== identity.name && identity.name) changes.name = identity.name;
  if (identity.imageUrl && user.avatar_url !== identity.imageUrl) {
    changes.avatar_url = identity.imageUrl;
  }
  if (declaredRole && declaredRole !== user.role) changes.role = declaredRole;

  if (Object.keys(changes).length === 0) return user;

  const adminClient = createAdminClient();
  const { data: updated, error } = await adminClient
    .from('users')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) {
    // Un fallo de sincronización cosmética nunca debe tumbar la petición.
    console.error('No se pudo sincronizar el perfil desde Clerk:', error.message);
    return user;
  }

  const synced = updated as User;
  if (changes.role) await ensureProductAccessAndBalances(synced);
  return synced;
}
