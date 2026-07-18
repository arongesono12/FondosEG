'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAuthErrorMessage } from '@/lib/supabase/auth-errors';
import { isValidEmailDomain, isValidEmailFormat, validatePassword } from '@/lib/email-validation';
import type { RegisterFormData } from '@/types';

export async function developerSignUpAction(data: RegisterFormData) {
  const email = data.email.toLowerCase().trim();
  if (!isValidEmailFormat(email)) return { success: false, error: 'El formato del correo es inválido' };
  const domain = isValidEmailDomain(email);
  if (!domain.valid) return { success: false, error: domain.message };
  const password = validatePassword(data.password);
  if (!password.valid) return { success: false, error: password.errors[0] };
  if (data.name.trim().length < 3) return { success: false, error: 'Indica tu nombre completo' };

  const admin = createAdminClient();
  let createdUserId: string | null = null;
  const [{ data: dashboardUser }, { data: developer }] = await Promise.all([
    admin.from('users').select('id').eq('email', email).maybeSingle(),
    admin.from('developer_profiles').select('user_id').eq('email', email).maybeSingle(),
  ]);
  if (dashboardUser || developer) {
    return { success: false, error: 'Este correo ya pertenece a una cuenta. Solo un administrador puede habilitar acceso adicional.' };
  }

  try {
    const supabase = await createClient();
    const { data: signUp, error } = await supabase.auth.signUp({
      email, password: data.password,
      options: { data: { name: data.name, phone: data.phone, account_type: 'developer' } },
    });
    if (error || !signUp.user) throw error || new Error('No se pudo crear la cuenta');
    createdUserId = signUp.user.id;
    const { error: profileError } = await admin.from('developer_profiles').insert({
      user_id: signUp.user.id, name: data.name.trim(), email, phone: data.phone || null,
      country: data.country || null, city: data.city || null,
    });
    if (profileError) throw profileError;
    const { error: accessError } = await admin.from('account_access').insert({
      user_id: signUp.user.id, product: 'developer_portal', access_role: 'developer', status: 'active',
    });
    if (accessError) throw accessError;
    return { success: true, user: signUp.user, email, name: data.name.trim(), role: 'cliente', verificationRequired: true };
  } catch (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
    if (message.includes('account_access') || message.includes('developer_profiles')) {
      return {
        success: false,
        error: 'El portal de desarrolladores aún no está habilitado en la base de datos. Aplica la migración 20260718_separate_product_access.sql.',
      };
    }
    return { success: false, error: getAuthErrorMessage(error) };
  }
}
