import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { User, UserRole } from '@/types';

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthzError';
    this.status = status;
  }
}

export async function requireAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthzError('Unauthorized', 401);
  }

  return user.id;
}

export async function requireProfile(): Promise<User> {
  const userId = await requireAuthUserId();
  const adminClient = createAdminClient();
  const { data: profile, error } = await adminClient.from('users').select('*').eq('id', userId).single();

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

