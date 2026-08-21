import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import type { AccessProduct, AccountAccess, User, UserRole } from '@/types';
import { isAdminRole, isSuperAdminRole } from '@/lib/roles';
import {
  getClerkIdentity,
  resolveInternalUser,
  syncFromClerk,
  type ClerkIdentity,
} from '@/lib/server/clerk-identity';

/**
 * Frontera de autenticación y autorización.
 *
 * La identidad la provee Clerk; el rol, el acceso por producto y el perfil
 * siguen viviendo en Supabase. La API pública de este módulo no ha cambiado con
 * la migración, así que las rutas de `app/api/**` no necesitan tocarse.
 *
 * `AuthUser.id` es SIEMPRE el UUID interno de `public.users`, nunca el id de
 * Clerk. Todo lo que ya consultaba por ese id sigue siendo correcto.
 */

export interface AuthUser {
  /** UUID interno de `public.users`. */
  id: string;
  /** Identificador de Clerk (`user_...`). */
  clerkUserId: string;
  email: string;
  /** Compatibilidad con el consumo previo de `user_metadata`. */
  user_metadata: { name?: string; avatar_url?: string };
}

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthzError';
    this.status = status;
  }
}

export class AuthServiceError extends AuthzError {
  constructor(message = 'El servicio de autenticación no está disponible temporalmente. Intenta de nuevo en unos segundos.') {
    super(message, 503);
    this.name = 'AuthServiceError';
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 200
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (isAuthServiceUnavailableError(error) && attempt < maxAttempts) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.warn(`Auth retry attempt ${attempt}/${maxAttempts} after error:`, error instanceof Error ? error.message : 'Unknown');
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function toAuthUser(profile: User, identity: ClerkIdentity): AuthUser {
  return {
    id: profile.id,
    clerkUserId: identity.clerkUserId,
    email: profile.email || identity.email,
    user_metadata: {
      name: profile.name || identity.name,
      avatar_url: profile.avatar_url || identity.imageUrl || undefined,
    },
  };
}

/**
 * Resuelve la sesión de Clerk al perfil interno, aprovisionándolo si es la
 * primera visita. Devuelve el error en lugar de lanzarlo para que las capas
 * superiores decidan entre "no autenticado" y "servicio caído".
 */
async function resolveAuthUser(): Promise<{
  user: AuthUser | null;
  profile: User | null;
  authError: unknown | null;
  /** Identidad válida en Clerk que todavía no ha completado el alta guiada. */
  needsOnboarding: boolean;
}> {
  try {
    const identity = await withRetry(() => getClerkIdentity());
    if (!identity) {
      return { user: null, profile: null, authError: null, needsOnboarding: false };
    }

    const profile = await withRetry(() => resolveInternalUser(identity));
    if (!profile) {
      return { user: null, profile: null, authError: null, needsOnboarding: true };
    }

    return {
      user: toAuthUser(profile, identity),
      profile,
      authError: null,
      needsOnboarding: false,
    };
  } catch (error) {
    // La autorización falla cerrada.
    return { user: null, profile: null, authError: error, needsOnboarding: false };
  }
}

export async function getOptionalAuthState(): Promise<{
  user: AuthUser | null;
  serviceUnavailable: boolean;
  /**
   * Hay sesión de Clerk pero aún no hay perfil interno: el usuario debe
   * completar `/onboarding` antes de poder entrar a ninguna parte.
   */
  needsOnboarding: boolean;
}> {
  const { user, authError, needsOnboarding } = await resolveAuthUser();

  if (user) {
    return { user, serviceUnavailable: false, needsOnboarding: false };
  }

  if (needsOnboarding) {
    return { user: null, serviceUnavailable: false, needsOnboarding: true };
  }

  if (authError && isAuthServiceUnavailableError(authError)) {
    console.error('No se pudo resolver el usuario autenticado:', authError);
    return { user: null, serviceUnavailable: true, needsOnboarding: false };
  }

  if (authError) {
    console.error('Error resolviendo la identidad:', authError);
  }

  return { user: null, serviceUnavailable: false, needsOnboarding: false };
}

export async function getOptionalAuthUser(): Promise<AuthUser | null> {
  const { user } = await getOptionalAuthState();
  return user;
}

export async function requireAuthUser(): Promise<AuthUser> {
  const { user, authError, needsOnboarding } = await resolveAuthUser();

  if (user) {
    return user;
  }

  // Autenticado en Clerk pero sin perfil: no puede operar todavía. 403 y no
  // 401, porque el problema no es quién es sino que le falta completar el alta.
  if (needsOnboarding) {
    throw new AuthzError('Onboarding required', 403);
  }

  if (authError) {
    if (isAuthServiceUnavailableError(authError)) {
      throw new AuthServiceError(getAuthErrorMessage(authError));
    }

    throw new AuthzError(getAuthErrorMessage(authError, 'Unauthorized'), 401);
  }

  throw new AuthzError('Unauthorized', 401);
}

export async function requireAuthUserId(): Promise<string> {
  const user = await requireAuthUser();
  return user.id;
}

export async function getProductAccess(
  product: AccessProduct,
  userId?: string
): Promise<AccountAccess | null> {
  const resolvedUserId = userId ?? await requireAuthUserId();
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('account_access')
    .select('user_id, product, access_role, status')
    .eq('user_id', resolvedUserId)
    .eq('product', product)
    .maybeSingle();

  if (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
    const accessTableMissing = code === '42P01' || code === 'PGRST205' || message.includes('account_access');

    // Puente de despliegue seguro: las cuentas financieras existentes conservan
    // acceso al Dashboard y sólo los administradores entran al portal de
    // desarrolladores, para no tumbar la app si el código llega a un entorno
    // justo antes de su migración de base de datos.
    if (accessTableMissing) {
      const { data: legacyProfile, error: legacyError } = await adminClient
        .from('users')
        .select('role,is_active')
        .eq('id', resolvedUserId)
        .maybeSingle();
      if (legacyError || !legacyProfile || legacyProfile.is_active === false) return null;
      const role = legacyProfile.role as UserRole;
      if (product === 'developer_portal' && !isAdminRole(role)) return null;
      return {
        user_id: resolvedUserId,
        product,
        access_role: role,
        status: 'active',
      };
    }

    if (isAuthServiceUnavailableError(error)) throw new AuthServiceError(getAuthErrorMessage(error));
    throw new AuthzError(getAuthErrorMessage(error, 'No se pudo comprobar el acceso a la aplicación'), 500);
  }
  return (data as AccountAccess | null) ?? null;
}

export async function requireProductAccess(product: AccessProduct): Promise<AccountAccess> {
  const access = await getProductAccess(product);
  if (!access || access.status !== 'active') throw new AuthzError('Forbidden', 403);
  return access;
}

export function requireDashboardAccess() {
  return requireProductAccess('dashboard');
}

export function requireDeveloperAccess() {
  return requireProductAccess('developer_portal');
}

export async function requireProfile(): Promise<User> {
  const { user, profile, authError } = await resolveAuthUser();

  if (authError) {
    if (isAuthServiceUnavailableError(authError)) {
      throw new AuthServiceError(getAuthErrorMessage(authError));
    }
    throw new AuthzError(getAuthErrorMessage(authError, 'Unauthorized'), 401);
  }

  if (!user || !profile) {
    throw new AuthzError('Unauthorized', 401);
  }

  if (profile.is_active === false) {
    throw new AuthzError('Account disabled', 403);
  }

  const identity = await getClerkIdentity();
  if (!identity) {
    throw new AuthzError('Unauthorized', 401);
  }

  return syncFromClerk(profile, identity);
}

export function requireRole(profile: User, roles: UserRole | UserRole[]): void {
  const allowed = Array.isArray(roles) ? [...roles] : [roles];
  if (allowed.includes('admin') && !allowed.includes('superadmin')) {
    allowed.push('superadmin');
  }
  if (!allowed.includes(profile.role)) {
    throw new AuthzError('Forbidden', 403);
  }
}

export function requireSelfOrAdmin(profile: User, targetUserId: string): void {
  if (isAdminRole(profile.role)) return;
  if (profile.id !== targetUserId) {
    throw new AuthzError('Forbidden', 403);
  }
}

export function requireSuperAdmin(profile: User): void {
  if (!isSuperAdminRole(profile.role)) {
    throw new AuthzError('Forbidden', 403);
  }
}
