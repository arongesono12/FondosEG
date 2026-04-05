'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import type { RegisterFormData } from '@/types';
import { isValidEmailDomain, isValidEmailFormat, validatePassword } from '@/lib/email-validation';
import { generateAndSendOTP, verifyOTP } from '@/lib/server/otp-service';

export async function signUpAction(data: RegisterFormData) {
  const adminClient = createAdminClient();

  if (!isValidEmailFormat(data.email)) {
    return { success: false, error: 'El formato del correo electrónico es inválido' };
  }

  const emailValidation = isValidEmailDomain(data.email);
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.message };
  }

  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.errors[0] };
  }

  const { data: existingUser } = await adminClient
    .from('users')
    .select('email')
    .eq('email', data.email.toLowerCase())
    .single();

  if (existingUser) {
    return { success: false, error: 'El correo electrónico ya está registrado' };
  }

  const { data: authData, error } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: false,
    user_metadata: {
      name: data.name,
      phone: data.phone,
      role: data.role,
      document_type: data.document_type,
      document_number: data.document_number,
      country: data.country,
      city: data.city,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { 
    success: true, 
    user: authData.user,
    requiresVerification: true,
    email: data.email,
    name: data.name
  };
}

/**
 * Send the initial OTP after registration.
 * Calls the OTP service directly — no self-fetch HTTP round-trip.
 */
export async function sendVerificationEmail(userId: string, email: string, name: string) {
  return generateAndSendOTP(userId, email, name, false);
}

/**
 * Verify a submitted OTP code.
 * Calls the OTP service directly — no self-fetch HTTP round-trip.
 */
export async function verifyEmailCode(userId: string, email: string, code: string) {
  return verifyOTP(userId, email, code);
}

/**
 * Resend an OTP (blocked while a valid code still exists).
 * Calls the OTP service directly — no self-fetch HTTP round-trip.
 */
export async function resendVerificationEmail(userId: string, email: string, name: string) {
  return generateAndSendOTP(userId, email, name, true);
}

export async function signInAction(email: string, password: string) {
  try {
    const supabase = await createClient();
    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error && isAuthServiceUnavailableError(error)) {
      console.warn('Retrying sign-in after transient auth network failure:', error);
      const retryResult = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('SignIn error:', error);
      return { success: false, error: getAuthErrorMessage(error) };
    }

    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    console.error('Fatal SignIn error:', err);
    return {
      success: false,
      error: getAuthErrorMessage(err, 'No se pudo conectar con el servicio de autenticacion. Verifica tu red e intenta de nuevo.'),
    };
  }
}

export async function signOutAction() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('SignOut error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('SignOut exception:', err);
    return { success: true };
  }
}
