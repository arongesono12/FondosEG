'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getAuthErrorMessage } from '@/lib/supabase/auth-errors';
import { validatePassword } from '@/lib/email-validation';

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const userId = formData.get('userId') as string;

  if (!name?.trim() || !userId) {
    return { success: false, error: 'Completa los datos requeridos para guardar el perfil.' };
  }

  const { error } = await supabase
    .from('users')
    .update({ name: name.trim(), phone: phone?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    return { success: false, error: 'No se pudo guardar el perfil.' };
  }

  revalidatePath('/profile');
  return { success: true };
}

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient();
  
  const file = formData.get('avatar') as File;
  const userId = formData.get('userId') as string;
  const oldAvatarUrl = formData.get('oldAvatarUrl') as string;

  if (!file || !userId) {
    return { success: false, error: 'Faltan datos requeridos' };
  }

  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'El archivo seleccionado no es una imagen válida.' };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: 'El avatar recortado no debe superar los 2 MB.' };
  }

  // Delete old avatar if exists
  if (oldAvatarUrl) {
    try {
      // Extract the path from the public URL
      // Example: https://.../storage/v1/object/public/avatars/userId/filename.jpg
      const urlParts = oldAvatarUrl.split('/avatars/');
      if (urlParts.length > 1) {
        const oldPath = urlParts[1];
        await supabase.storage.from('avatars').remove([oldPath]);
      }
    } catch (e) {
      console.error('Error deleting old avatar:', e);
      // We continue even if deletion fails to not block the new upload
    }
  }

  // Upload file to Supabase Storage
  const filePath = `${userId}/${Math.random().toString(36).substring(2)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: 'No se pudo subir el avatar.' };
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Update user record with new avatar URL
  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    return { success: false, error: 'No se pudo guardar el avatar en el perfil.' };
  }

  revalidatePath('/profile');
  return { success: true, avatarUrl: publicUrl };
}

export async function updatePasswordAction(formData: FormData) {
  const supabase = await createClient();

  const newPassword = (formData.get('newPassword') as string) || '';
  const confirmPassword = (formData.get('confirmPassword') as string) || '';

  if (!newPassword || !confirmPassword) {
    return { success: false, error: 'Completa todos los campos de contraseña' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'La confirmación no coincide con la nueva contraseña' };
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.errors[0] };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: getAuthErrorMessage(authError, 'No se pudo validar la sesión actual. Inicia sesión de nuevo.'),
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }

  revalidatePath('/profile');
  return { success: true };
}
