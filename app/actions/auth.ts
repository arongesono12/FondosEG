'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import type { RegisterFormData } from '@/types';
import { isValidEmailDomain, isValidEmailFormat, validatePassword } from '@/lib/email-validation';
import { provisionPendingUserProfile } from '@/lib/server/user-provisioning';

export async function signUpAction(data: RegisterFormData) {
  const adminClient = createAdminClient();
  const normalizedEmail = data.email.toLowerCase().trim();

  if (data.role !== 'cliente' && data.role !== 'gestor') {
    return { success: false, error: 'El rol solicitado no está permitido para el registro público' };
  }

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

  const supabase = await createClient();
  let authUser;
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: data.password,
      options: {
        data: {
          name: data.name,
          phone: data.phone,
          role: data.role,
          document_type: data.document_type,
          document_number: data.document_number,
          country: data.country,
          city: data.city,
        },
      },
    });

    if (signUpError || !signUpData.user) {
      throw signUpError || new Error('No se pudo crear la cuenta.');
    }

    authUser = signUpData.user;
    await provisionPendingUserProfile(adminClient, authUser, {
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
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }

  return { 
    success: true, 
    user: authUser,
    email: normalizedEmail,
    name: data.name,
    role: data.role,
    verificationRequired: true,
  };
}

export async function verifyEmailCode(_userId: string, email: string, code: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.toLowerCase().trim(),
    token: code,
    type: 'signup',
  });

  if (error || !data.user) {
    return { success: false, error: getAuthErrorMessage(error, 'El código es inválido o ha caducado.') };
  }

  const adminClient = createAdminClient();
  const { error: profileError } = await adminClient
    .from('users')
    .update({ is_verified: true, updated_at: new Date().toISOString() })
    .eq('id', data.user.id);

  if (profileError) {
    return { success: false, error: 'El correo fue confirmado, pero no se pudo actualizar el perfil.' };
  }

  return { success: true };
}

/**
 * Resend an OTP.
 */
export async function resendVerificationEmail(_userId: string, email: string, name: string) {
  void name;
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.toLowerCase().trim(),
  });

  if (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }

  return { success: true, expiresIn: 900 };
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

    if (!data.session || !data.user) {
      return { success: false, error: 'No se pudo iniciar sesión. Inténtalo de nuevo.' };
    }

    return { success: true };
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
