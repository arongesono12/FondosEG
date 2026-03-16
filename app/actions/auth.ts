'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { RegisterFormData } from '@/types';

export async function signUpAction(data: RegisterFormData) {
  const adminClient = createAdminClient();

  const { data: authData, error } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
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

  return { success: true, user: authData.user };
}

export async function signInAction(email: string, password: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('SignIn error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    console.error('Fatal SignIn error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Error de red inesperado' };
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
