import { isAuthRetryableFetchError } from '@supabase/supabase-js';

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;

  if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  if ('cause' in error) {
    return getErrorCode((error as { cause?: unknown }).cause);
  }

  return undefined;
}

function hasMessage(error: unknown, pattern: string): boolean {
  if (!(error instanceof Error)) return false;

  if (error.message.toLowerCase().includes(pattern.toLowerCase())) {
    return true;
  }

  if ('cause' in error) {
    return hasMessage((error as { cause?: unknown }).cause, pattern);
  }

  return false;
}

export function isAuthServiceUnavailableError(error: unknown): boolean {
  return (
    isAuthRetryableFetchError(error) ||
    getErrorCode(error) === 'UND_ERR_CONNECT_TIMEOUT' ||
    hasMessage(error, 'fetch failed') ||
    hasMessage(error, 'connect timeout')
  );
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
