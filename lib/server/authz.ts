import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import type { AccessProduct, AccountAccess, User, UserRole } from '@/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminRole, isSuperAdminRole } from '@/lib/roles';

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

async function resolveAuthUser(): Promise<{ user: SupabaseUser | null; authError: unknown | null }> {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error } = await withRetry(async () => {
      const result = await supabase.auth.getUser();
      if (result.error && isAuthServiceUnavailableError(result.error)) {
        throw result.error; // Trigger retry
      }
      return result;
    });

    if (user) return { user, authError: null };
    return { user: null, authError: error };
  } catch (error) {
    // Authorization must fail closed. getSession() only reads local cookie
    // state and is not a substitute for server-side token validation.
    return { user: null, authError: error };
  }
}

export async function getOptionalAuthState(): Promise<{
  user: SupabaseUser | null;
  serviceUnavailable: boolean;
}> {
  const { user, authError } = await resolveAuthUser();

  if (user) {
    return { user, serviceUnavailable: false };
  }

  if (authError && isAuthServiceUnavailableError(authError)) {
    console.error('Unable to resolve authenticated user because Supabase auth is unreachable:', authError);
    return { user: null, serviceUnavailable: true };
  }

  return { user: null, serviceUnavailable: false };
}

export async function getOptionalAuthUser(): Promise<SupabaseUser | null> {
  const { user } = await getOptionalAuthState();
  return user;
}

export async function requireAuthUser(): Promise<SupabaseUser> {
  const { user, authError } = await resolveAuthUser();

  if (user) {
    return user;
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

    // Safe deployment bridge: existing financial accounts keep Dashboard access,
    // while only existing administrators may enter the developer portal. This
    // avoids taking the app down if code reaches an environment just before its
    // database migration, without broadening developer access.
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
  const userId = await requireAuthUserId();
  const adminClient = createAdminClient();
  let profile: User | null = null;
  let error: unknown = null;

  try {
    const result = await withRetry(async () => {
      const res = await adminClient.from('users').select('*').eq('id', userId).single();
      if (res.error && isAuthServiceUnavailableError(res.error)) {
        throw res.error; // Trigger retry
      }
      return res;
    });
    profile = (result.data as User | null) ?? null;
    error = result.error;
  } catch (queryError) {
    if (isAuthServiceUnavailableError(queryError)) {
      throw new AuthServiceError(getAuthErrorMessage(queryError));
    }
    throw queryError;
  }

  if (error && isAuthServiceUnavailableError(error)) {
    throw new AuthServiceError(getAuthErrorMessage(error));
  }

  if (error || !profile) {
    throw new AuthzError('Unauthorized', 401);
  }

  if (profile.is_active === false) {
    throw new AuthzError('Account disabled', 403);
  }

  return profile as User;
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
