'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import type { RegisterFormData } from '@/types';
import { isValidEmailDomain, isValidEmailFormat, validatePassword } from '@/lib/email-validation';

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

export async function sendVerificationEmail(userId: string, email: string, name: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, name, action: 'initial' }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: 'Error al enviar el correo de verificación' };
  }
}

export async function verifyEmailCode(userId: string, email: string, code: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/otp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, code }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error verifying code:', error);
    return { success: false, error: 'Error al verificar el código' };
  }
}

export async function resendVerificationEmail(userId: string, email: string, name: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, name, action: 'resend' }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error resending verification email:', error);
    return { success: false, error: 'Error al reenviar el código' };
  }
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
