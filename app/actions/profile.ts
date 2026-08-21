'use server';

import { revalidatePath } from 'next/cache';
import { clerkClient } from '@clerk/nextjs/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuthUser, requireProfile } from '@/lib/server/authz';
import { validatePassword } from '@/lib/email-validation';

/**
 * Acciones de perfil.
 *
 * Tras la migración a Clerk, el `userId` ya NO se lee del formulario: se toma
 * siempre de la sesión verificada en servidor. Antes, quien enviase el
 * formulario podía escribir un `userId` arbitrario y editar el perfil de otra
 * persona.
 */

export async function updateProfileAction(formData: FormData) {
  const profile = await requireProfile();

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const phone = (formData.get('phone') as string | null)?.trim() ?? '';

  if (!name) {
    return { success: false, error: 'Completa los datos requeridos para guardar el perfil.' };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('users')
    .update({ name, phone: phone || null, updated_at: new Date().toISOString() })
    .eq('id', profile.id);

  if (error) {
    // El índice único parcial de teléfono es el único choque esperable aquí.
    if (error.code === '23505') {
      return { success: false, error: 'Ese número de teléfono ya está registrado en otra cuenta.' };
    }
    console.error('updateProfileAction:', error.message);
    return { success: false, error: 'No se pudo guardar el perfil.' };
  }

  revalidatePath('/profile');
  return { success: true };
}

export async function uploadAvatarAction(formData: FormData) {
  const profile = await requireProfile();

  const file = formData.get('avatar') as File | null;
  const oldAvatarUrl = (formData.get('oldAvatarUrl') as string | null) ?? profile.avatar_url ?? '';

  if (!file) {
    return { success: false, error: 'Faltan datos requeridos' };
  }

  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'El archivo seleccionado no es una imagen válida.' };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: 'El avatar recortado no debe superar los 2 MB.' };
  }

  const adminClient = createAdminClient();

  if (oldAvatarUrl) {
    try {
      const urlParts = oldAvatarUrl.split('/avatars/');
      if (urlParts.length > 1) {
        await adminClient.storage.from('avatars').remove([urlParts[1]]);
      }
    } catch (e) {
      console.error('Error deleting old avatar:', e);
      // Se continúa: no bloquear la subida nueva por un borrado fallido.
    }
  }

  const filePath = `${profile.id}/${Math.random().toString(36).substring(2)}.jpg`;

  const { error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(filePath, file, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    console.error('uploadAvatarAction:', uploadError.message);
    return { success: false, error: 'No se pudo subir el avatar.' };
  }

  const {
    data: { publicUrl },
  } = adminClient.storage.from('avatars').getPublicUrl(filePath);

  const { error: updateError } = await adminClient
    .from('users')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', profile.id);

  if (updateError) {
    console.error('uploadAvatarAction:', updateError.message);
    return { success: false, error: 'No se pudo guardar el avatar en el perfil.' };
  }

  revalidatePath('/profile');
  return { success: true, avatarUrl: publicUrl };
}

export async function updatePasswordAction(formData: FormData) {
  const authUser = await requireAuthUser();

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

  try {
    const clerk = await clerkClient();
    await clerk.users.updateUser(authUser.clerkUserId, { password: newPassword });
  } catch (error) {
    // Clerk rechaza contraseñas filtradas en brechas conocidas y las que no
    // cumplen la política de la instancia.
    const message =
      typeof error === 'object' && error && 'errors' in error
        ? String((error as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ?? '')
        : '';

    if (message.toLowerCase().includes('breach') || message.toLowerCase().includes('pwned')) {
      return {
        success: false,
        error: 'Esa contraseña aparece en filtraciones públicas. Elige otra distinta.',
      };
    }

    console.error('updatePasswordAction:', error);
    return { success: false, error: 'No se pudo actualizar la contraseña.' };
  }

  revalidatePath('/profile');
  return { success: true };
}
