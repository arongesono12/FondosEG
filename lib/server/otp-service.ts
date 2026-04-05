/**
 * lib/server/otp-service.ts
 * 
 * Centralized OTP service — used directly by Server Actions and Route Handlers.
 * Eliminates the self-fetch anti-pattern where a Server Action called its own
 * HTTP route, causing port mismatch errors and potential deadlocks in production.
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOTPEmail } from '@/lib/email-service';

const OTP_EXPIRY_MINUTES = 15;
const MAX_ATTEMPTS       = 5;

function generateOTPCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

export interface OTPResult {
  success: boolean;
  error?: string;
  expiresIn?: number; // seconds
}

export interface VerifyResult {
  success: boolean;
  error?: string;
}

/**
 * Generate and send an OTP code for email verification.
 * - Invalidates any existing pending codes for this user.
 * - Inserts a new record in `email_verification`.
 * - Sends the code via Resend.
 *
 * @param userId   Auth user UUID
 * @param email    Destination email
 * @param name     User display name (for email template)
 * @param isResend Pass true to block resend while a valid code still exists
 */
export async function generateAndSendOTP(
  userId: string,
  email: string,
  name: string,
  isResend = false,
): Promise<OTPResult> {
  if (!userId || !email) {
    return { success: false, error: 'userId y email son requeridos' };
  }

  const adminClient = createAdminClient();

  // --- Guard: block resend while an active code exists ---
  if (isResend) {
    const { data: existing } = await adminClient
      .from('email_verification')
      .select('expires_at')
      .eq('user_id', userId)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing && new Date(existing.expires_at) > new Date()) {
      return {
        success: false,
        error: 'Ya existe un código activo. Espera a que expire o usa el código actual.',
      };
    }
  }

  // --- Invalidate any previous pending codes ---
  await adminClient
    .from('email_verification')
    .update({ verified_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('verified_at', null);

  // --- Generate new OTP ---
  const code      = generateOTPCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1_000);

  const { error: insertError } = await adminClient
    .from('email_verification')
    .insert({
      user_id:    userId,
      email:      email.toLowerCase(),
      code,
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    console.error('[OTP] Insert error:', insertError);
    return { success: false, error: `Error al generar el código: ${insertError.message}` };
  }

  // --- Send via Resend ---
  const emailResult = await sendOTPEmail({
    to:   email,
    name: name || 'Usuario',
    code,
  });

  if (!emailResult.success) {
    console.error('[OTP] Email send error:', emailResult.error);
    return {
      success: false,
      error: `Error al enviar el correo: ${emailResult.error ?? 'Verifica que el email sea válido.'}`,
    };
  }

  console.log('[OTP] Code sent successfully to', email);
  return { success: true, expiresIn: OTP_EXPIRY_MINUTES * 60 };
}

/**
 * Verifiy an OTP code submitted by the user.
 * - Checks expiry and attempt limit.
 * - On success: marks the record as verified + sets users.is_verified = true.
 */
export async function verifyOTP(
  userId: string,
  email: string,
  code: string,
): Promise<VerifyResult> {
  if (!userId || !email || !code) {
    return { success: false, error: 'userId, email y código son requeridos' };
  }

  const adminClient = createAdminClient();

  const { data: verification, error: findError } = await adminClient
    .from('email_verification')
    .select('*')
    .eq('user_id', userId)
    .eq('code',    code)
    .eq('email',   email.toLowerCase())
    .is('verified_at', null)
    .single();

  if (findError || !verification) {
    return { success: false, error: 'Código inválido o expirado' };
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    return { success: false, error: 'Demasiados intentos. Solicita un nuevo código.' };
  }

  if (new Date(verification.expires_at) < new Date()) {
    return { success: false, error: 'El código ha expirado. Solicita uno nuevo.' };
  }

  // --- Mark as verified ---
  const { error: updateError } = await adminClient
    .from('email_verification')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', verification.id);

  if (updateError) {
    console.error('[OTP] Verify update error:', updateError);
    return { success: false, error: 'Error al verificar el código' };
  }

  // --- Update user is_verified flag ---
  const { error: userUpdateError } = await adminClient
    .from('users')
    .update({ is_verified: true })
    .eq('id', userId);

  if (userUpdateError) {
    // Non-fatal: log and continue — the email_verification record is already marked
    console.error('[OTP] User is_verified update error:', userUpdateError.message);
  }

  return { success: true };
}

/**
 * Get current OTP status for a user (used by the client to show timer/attempts).
 */
export async function getOTPStatus(userId: string, email: string) {
  if (!userId || !email) return null;

  const adminClient = createAdminClient();

  const { data: verification } = await adminClient
    .from('email_verification')
    .select('expires_at, attempts, created_at')
    .eq('user_id', userId)
    .eq('email',   email.toLowerCase())
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!verification) return null;

  const isExpired          = new Date(verification.expires_at) < new Date();
  const remainingAttempts  = MAX_ATTEMPTS - verification.attempts;

  return {
    expiresAt:        verification.expires_at,
    isExpired,
    attempts:         verification.attempts,
    remainingAttempts,
  };
}
