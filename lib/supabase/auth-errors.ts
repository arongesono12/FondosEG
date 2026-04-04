import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { isTransientNetworkError } from '@/lib/network-errors';

export function isAuthServiceUnavailableError(error: unknown): boolean {
  return isAuthRetryableFetchError(error) || isTransientNetworkError(error);
}

export function getAuthErrorMessage(
  error: unknown,
  fallback = 'El servicio de autenticacion no esta disponible temporalmente. Intenta de nuevo en unos segundos.'
): string {
  if (isAuthServiceUnavailableError(error)) {
    return fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
