'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import type { RegisterFormData } from '@/types';
import { isValidEmailDomain, isValidEmailFormat, validatePassword } from '@/lib/email-validation';
import { generateAndSendOTP, verifyOTP } from '@/lib/server/otp-service';
import { provisionUserAccount } from '@/lib/server/user-provisioning';

export async function signUpAction(data: RegisterFormData) {
  const adminClient = createAdminClient();
  const normalizedEmail = data.email.toLowerCase().trim();

  if (!isValidEmailFormat(normalizedEmail)) {
    return { success: false, error: 'El formato del correo electrónico es inválido' };
  }

  const emailValidation = isValidEmailDomain(normalizedEmail);
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
    .eq('email', normalizedEmail)
    .single();

  if (existingUser) {
    return { success: false, error: 'El correo electrónico ya está registrado' };
  }

  let authUser;
  try {
    const provisionResult = await provisionUserAccount(adminClient, {
      email: normalizedEmail,
      password: data.password,
      name: data.name,
      phone: data.phone,
      role: data.role,
      documentType: data.document_type,
      documentNumber: data.document_number,
      country: data.country,
      city: data.city,
    });
    authUser = provisionResult.user;
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }

  const supabase = await createClient();
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: data.password,
  });

  if (signInError || !sessionData.user) {
    console.error('Auto sign-in after registration failed:', signInError);
    return {
      success: false,
      error: signInError?.message || 'La cuenta fue creada, pero no se pudo iniciar la sesión automáticamente.',
    };
  }

  return { 
    success: true, 
    user: authUser,
    session: sessionData.session,
    email: normalizedEmail,
    name: data.name,
    role: data.role,
    dashboardPath: '/dashboard',
  };
}

/**
 * Send the initial OTP after registration.
 */
export async function sendVerificationEmail(userId: string, email: string, name: string) {
  return generateAndSendOTP(userId, email, name, false);
}

/**
 * Verify a submitted OTP code.
 */
export async function verifyEmailCode(userId: string, email: string, code: string) {
  return verifyOTP(userId, email, code);
}

/**
 * Resend an OTP.
 */
export async function resendVerificationEmail(userId: string, email: string, name: string) {
  return generateAndSendOTP(userId, email, name, true);
}

export async function signInAction(email: string, password: string) {
  try {
    const supabase = await createClient();
    const normalizedEmail = email.toLowerCase().trim();
    
    let { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error && isAuthServiceUnavailableError(error)) {
      console.warn('Retrying sign-in after transient auth network failure:', error);
      const retryResult = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
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
