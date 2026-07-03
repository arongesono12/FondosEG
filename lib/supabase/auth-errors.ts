import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { isTransientNetworkError } from '@/lib/network-errors';

export function isAuthServiceUnavailableError(error: unknown): boolean {
  return isAuthRetryableFetchError(error) || isTransientNetworkError(error);
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  const normalized = normalizeMessage(candidate.message ?? '');
  return (
    candidate.code === 'refresh_token_not_found' ||
    candidate.code === 'refresh_token_already_used' ||
    normalized.includes('invalid refresh token') ||
    normalized.includes('refresh token not found') ||
    normalized.includes('refresh token already used')
  );
}

function normalizeMessage(message: string): string {
  return message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function translateAuthErrorMessage(message: string): string {
  const normalized = normalizeMessage(message);

  if (
    normalized.includes('already been registered') ||
    normalized.includes('user already registered') ||
    normalized.includes('email address has already been registered') ||
    normalized.includes('duplicate key value violates unique constraint "users_email')
  ) {
    return 'Ya existe una cuenta registrada con este correo electrónico.';
  }

  if (normalized.includes('duplicate key value violates unique constraint "users_phone')) {
    return 'Ya existe una cuenta registrada con este número de teléfono.';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }

  if (
    normalized.includes('invalid refresh token') ||
    normalized.includes('refresh token not found') ||
    normalized.includes('refresh token already used')
  ) {
    return 'La sesión anterior ha caducado. Inicia sesión nuevamente.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
  }

  if (normalized.includes('signup is disabled')) {
    return 'El registro de nuevos usuarios está deshabilitado en este momento.';
  }

  if (normalized.includes('password should be at least')) {
    return 'La contraseña no cumple la longitud mínima requerida.';
  }

  if (
    normalized.includes('unable to validate email address: invalid format') ||
    normalized.includes('invalid email')
  ) {
    return 'El formato del correo electrónico es inválido.';
  }

  if (
    normalized.includes('email rate limit exceeded') ||
    normalized.includes('too many requests')
  ) {
    return 'Se han realizado demasiados intentos. Espera un momento e inténtalo de nuevo.';
  }

  if (normalized.includes('user not found')) {
    return 'No se encontró el usuario solicitado.';
  }

  if (normalized.includes('same password')) {
    return 'La nueva contraseña debe ser diferente de la actual.';
  }

  return message;
}

export function isDuplicateEmailAuthError(error: unknown): boolean {
  if (!(error instanceof Error) || !error.message.trim()) {
    return false;
  }

  const normalized = normalizeMessage(error.message);
  return (
    normalized.includes('already been registered') ||
    normalized.includes('user already registered') ||
    normalized.includes('email address has already been registered')
  );
}

export function getAuthErrorMessage(
  error: unknown,
  fallback = 'El servicio de autenticación no está disponible temporalmente. Intenta de nuevo en unos segundos.'
): string {
  if (isAuthServiceUnavailableError(error)) {
    return fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return translateAuthErrorMessage(error.message);
  }

  return fallback;
}
