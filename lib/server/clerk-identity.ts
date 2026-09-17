import 'server-only';

import { auth, currentUser } from '@clerk/nextjs/server';
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
  /**
   * Rol declarado en `publicMetadata` de Clerk, ya validado (o `null`).
   * Se captura de la misma llamada a `currentUser()` para no hacer una
   * segunda petición al Backend API al sincronizar.
   */
  declaredRole: UserRole | null;
}

/**
 * Obtiene sólo el identificador de sesión ya verificado por `clerkMiddleware`.
 *
 * A diferencia de `currentUser()`, `auth()` no pide el registro completo al
 * Backend API de Clerk. Las rutas del panel se cargan en paralelo y consultar
 * ese registro en cada una agotaba fácilmente el límite de una instancia de
 * desarrollo, convirtiendo lecturas de saldo/notificaciones en errores 503.
 */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
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

function isValidDeclaredRole(value: unknown): value is UserRole {
  return (
    value === 'admin' ||
    value === 'superadmin' ||
    value === 'gestor' ||
    value === 'cliente'
  );
}

/**
 * Lee el rol declarado en los metadatos públicos de Clerk, si lo hay.
 * Permite promover a `gestor`/`admin` desde el dashboard de Clerk sin tocar la
 * base de datos. Nunca se lee de `unsafeMetadata`, que el cliente puede editar.
 */
function roleFromClerk(clerkUser: ClerkUser): UserRole | null {
  const declared = (clerkUser.publicMetadata as Record<string, unknown> | null)?.role;
  return isValidDeclaredRole(declared) ? declared : null;
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
    declaredRole: roleFromClerk(clerkUser),
  };
}

/**
 * Busca el perfil ya vinculado sin hacer una llamada al Backend API de Clerk.
 * Es el camino normal después de la primera visita autenticada.
 */
export async function resolveInternalUserByClerkId(clerkUserId: string): Promise<User | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('users')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as User | null) ?? null;
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

  const byClerkId = await resolveInternalUserByClerkId(identity.clerkUserId);
  if (byClerkId) return byClerkId;

  // Cuenta preexistente de la era Supabase Auth: la reclamamos por correo.
  const { data: byEmail, error: byEmailError } = await adminClient
    .from('users')
    .select('*')
    .eq('email', identity.email)
    .maybeSingle();

  if (byEmailError) throw new Error(byEmailError.message);

  if (byEmail) {
    // Se reclama la cuenta preexistente. El avatar de Google se copia sólo si
    // Clerk trae una imagen: una subida a mano no se pisa con `null`.
    const linkChanges: Record<string, unknown> = {
      clerk_user_id: identity.clerkUserId,
      is_verified: true,
      updated_at: nowIso,
    };
    if (identity.imageUrl) linkChanges.avatar_url = identity.imageUrl;

    const { data: linked, error: linkError } = await adminClient
      .from('users')
      .update(linkChanges)
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
 * Sincroniza hacia la base de datos lo que el usuario tenga distinto en Clerk
 * (nombre, correo, avatar) y aplica el rol declarado en `publicMetadata`.
 *
 * No vuelve a llamar a `currentUser()`: el rol ya viaja en `identity` (capturado
 * en la misma petición que construyó la identidad), así que cada sincronización
 * cuesta una única llamada al Backend API de Clerk como máximo.
 *
 * Se usa desde dos sitios: la reconciliación perezosa de la entrada al
 * dashboard (`syncProfileFromClerkIfNeeded`) y el webhook `user.updated`
 * (`app/api/webhooks/clerk/route.ts`).
 */
export async function syncFromClerk(user: User, identity: ClerkIdentity): Promise<User> {
  const declaredRole = isValidDeclaredRole(identity.declaredRole) ? identity.declaredRole : null;

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

// ---------------------------------------------------------------------------
// Throttle de la reconciliación (entrada al dashboard)
// ---------------------------------------------------------------------------

const CLERK_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const CLERK_SYNC_INTERVAL_WITH_AVATAR_MS = 24 * 60 * 60 * 1000;

/**
 * Reconcilia el perfil con Clerk de forma perezosa: con avatar propio la
 * comprobación es diaria; sin avatar (caso típico de Google) es cada 15 min.
 * Lanza `currentUser()` (una única llamada al Backend API) y, si hubo cambios,
 * los persiste en la base de datos. Un fallo cosmético nunca tumba la carga
 * del dashboard.
 */
export async function syncProfileFromClerkIfNeeded(profile: User): Promise<User> {
  const lastSyncAt = profile.clerk_synced_at
    ? new Date(profile.clerk_synced_at).getTime()
    : 0;
  const hasAvatar = Boolean(profile.avatar_url?.trim());
  const threshold = hasAvatar
    ? CLERK_SYNC_INTERVAL_WITH_AVATAR_MS
    : CLERK_SYNC_INTERVAL_MS;

  if (Date.now() - lastSyncAt < threshold) return profile;

  let identity: ClerkIdentity | null = null;
  try {
    identity = await getClerkIdentity();
  } catch (error) {
    console.error(
      'No se pudo obtener la identidad de Clerk para reconciliar:',
      error instanceof Error ? error.message : error,
    );
    return profile;
  }
  if (!identity) return profile;

  try {
    const synced = await syncFromClerk(profile, identity);
    // Marca siempre, aunque no haya cambios, para no repetir la llamada hasta
    // el próximo intervalo.
    await markClerkSyncChecked(profile.id);
    return synced;
  } catch (error) {
    console.error(
      'No se pudo aplicar la reconciliación de Clerk:',
      error instanceof Error ? error.message : error,
    );
    return profile;
  }
}

async function markClerkSyncChecked(userId: string): Promise<void> {
  try {
    const adminClient = createAdminClient();
    await adminClient
      .from('users')
      .update({ clerk_synced_at: new Date().toISOString() })
      .eq('id', userId);
  } catch {
    // El throttle falla abierto: peor caso, una llamada extra a Clerk.
  }
}

// ---------------------------------------------------------------------------
// Conciliación por webhook (user.created / user.updated)
// ---------------------------------------------------------------------------

export interface ClerkWebhookProfileSource {
  clerkUserId: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  declaredRole: string | null;
}

async function findInternalUserByEmail(email: string): Promise<User | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as User | null) ?? null;
}

/**
 * Reconcilia un perfil existente con los datos que recibe el webhook de Clerk
 * (`user.created` / `user.updated`). Si el perfil aún no existe en la app
 * (alta aún no completada), no hace nada — la sincronización ocurrirá vía
 * `completeOnboarding` / `syncProfileFromClerkIfNeeded`.
 *
 * El webhook de Clerk es la vía autoritativa para cambios posteriores (nombre,
 * avatar, correo) y evita depender exclusivamente de la petición del layout
 * para mantenerlos frescos.
 */
export async function reconcileProfileFromClerkWebhook(
  source: ClerkWebhookProfileSource,
): Promise<void> {
  const profile =
    (await resolveInternalUserByClerkId(source.clerkUserId)) ??
    (source.email ? await findInternalUserByEmail(source.email) : null);

  if (!profile) return;

  const identity: ClerkIdentity = {
    clerkUserId: source.clerkUserId,
    email: source.email ?? profile.email,
    name: source.name ?? profile.name,
    imageUrl: source.imageUrl ?? profile.avatar_url ?? null,
    declaredRole: isValidDeclaredRole(source.declaredRole) ? source.declaredRole : null,
  };

  await syncFromClerk(profile, identity);
}
