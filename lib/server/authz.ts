import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import type { User, UserRole } from '@/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthzError';
    this.status = status;
  }
}

export class AuthServiceError extends AuthzError {
  constructor(message = 'Authentication service unavailable') {
    super(message, 503);
    this.name = 'AuthServiceError';
  }
}

async function resolveAuthUser(): Promise<{ user: SupabaseUser | null; authError: unknown | null }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (user) {
      return { user, authError: null };
    }

    if (error && isAuthServiceUnavailableError(error)) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          console.warn('Falling back to session user after getUser() network failure:', error);
          return { user: session.user, authError: null };
        }
      } catch (sessionError) {
        return { user: null, authError: sessionError };
      }

      return { user: null, authError: error };
    }

    return { user: null, authError: error };
  } catch (error) {
    if (isAuthServiceUnavailableError(error)) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          console.warn('Falling back to session user after thrown getUser() network failure:', error);
          return { user: session.user, authError: null };
        }
      } catch (sessionError) {
        return { user: null, authError: sessionError };
      }
    }

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

export async function requireProfile(): Promise<User> {
  const userId = await requireAuthUserId();
  const adminClient = createAdminClient();
  let profile: User | null = null;
  let error: unknown = null;

  try {
    const result = await adminClient.from('users').select('*').eq('id', userId).single();
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
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(profile.role)) {
    throw new AuthzError('Forbidden', 403);
  }
}

export function requireSelfOrAdmin(profile: User, targetUserId: string): void {
  if (profile.role === 'admin') return;
  if (profile.id !== targetUserId) {
    throw new AuthzError('Forbidden', 403);
  }
}
