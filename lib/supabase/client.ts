import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPA_KEY = '__supabase_client_instance__';

function getGlobal<T>(key: string): T | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  return (globalThis as Record<string, unknown>)[key] as T | undefined;
}

function setGlobal<T>(key: string, value: T): void {
  if (typeof globalThis !== 'undefined') {
    (globalThis as Record<string, unknown>)[key] = value;
  }
}

function getAuthStoragePrefix() {
  try {
    const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
    const projectRef = hostname.split('.')[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

/**
 * Removes a stale Supabase browser session before an explicit password login.
 * Auth layouts already redirect users with a valid server session, so reaching
 * the login form means any remaining browser token is safe to discard.
 */
export function prepareForFreshSignIn() {
  if (typeof window === 'undefined') return;

  const prefix = getAuthStoragePrefix();
  if (!prefix) return;

  document.cookie.split(';').forEach((entry) => {
    const cookieName = entry.split('=')[0]?.trim();
    if (cookieName?.startsWith(prefix)) {
      document.cookie = `${cookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  });

  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  if (typeof globalThis !== 'undefined') {
    delete (globalThis as Record<string, unknown>)[SUPA_KEY];
  }
}

export function createClient(): SupabaseClient {
  const cached = getGlobal<SupabaseClient>(SUPA_KEY);
  if (cached) {
    return cached;
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  setGlobal(SUPA_KEY, client);
  return client;
}
