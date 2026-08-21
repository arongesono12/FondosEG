import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';

import type { User, UserRole } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureProductAccessAndBalances } from '@/lib/server/clerk-identity';

/**
 * Alta de cuentas creadas por un administrador (gestores y staff).
 *
 * A diferencia del registro público — que ahora hace Clerk de principio a fin —
 * aquí el administrador fija la contraseña inicial y la cuenta nace ya
 * verificada. La identidad se crea en Clerk y acto seguido se materializa la
 * fila interna de `public.users` con su rol y sus saldos.
 */

interface ProvisionUserInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: UserRole;
  documentType?: string;
  documentNumber?: string;
  country?: string;
  city?: string;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function clerkErrorMessage(error: unknown, fallback: string): string {
  const errors = (error as { errors?: Array<{ message?: string; code?: string }> } | null)?.errors;
  const first = errors?.[0];
  if (!first) return fallback;

  if (first.code === 'form_identifier_exists') {
    return 'Ya existe una cuenta registrada con este correo electrónico.';
  }
  if (first.code === 'form_password_pwned') {
    return 'Esa contraseña aparece en filtraciones públicas. Elige otra distinta.';
  }
  if (first.code === 'form_password_length_too_short') {
    return 'La contraseña no cumple la longitud mínima requerida.';
  }
  return first.message || fallback;
}

/**
 * `adminClient` se mantiene en la firma por compatibilidad con las rutas que ya
 * lo construyen (app/api/agents, app/api/staff).
 */
export async function provisionUserAccount(
  adminClient: ReturnType<typeof createAdminClient>,
  input: ProvisionUserInput
): Promise<{ user: User; recoveredExistingAuthUser: boolean }> {
  const normalizedEmail = normalizeEmail(input.email);
  const nowIso = new Date().toISOString();

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(existingProfileError.message);
  }

  if (existingProfile) {
    throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
  }

  const clerk = await clerkClient();
  const { firstName, lastName } = splitName(input.name);

  let clerkUserId: string;
  let recoveredExistingAuthUser = false;

  try {
    const created = await clerk.users.createUser({
      emailAddress: [normalizedEmail],
      password: input.password,
      firstName,
      lastName: lastName || undefined,
      skipPasswordChecks: false,
      publicMetadata: { role: input.role },
    });
    clerkUserId = created.id;
  } catch (error) {
    // La identidad ya existe en Clerk pero no tiene perfil interno: la
    // reutilizamos en lugar de dejar al administrador bloqueado.
    const errors = (error as { errors?: Array<{ code?: string }> } | null)?.errors;
    if (errors?.[0]?.code !== 'form_identifier_exists') {
      throw new Error(clerkErrorMessage(error, 'No se pudo crear la cuenta.'));
    }

    const matches = await clerk.users.getUserList({ emailAddress: [normalizedEmail] });
    const existing = matches.data[0];
    if (!existing) {
      throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
    }

    await clerk.users.updateUser(existing.id, {
      password: input.password,
      firstName,
      lastName: lastName || undefined,
      publicMetadata: { role: input.role },
    });
    clerkUserId = existing.id;
    recoveredExistingAuthUser = true;
  }

  const { data: created, error: profileError } = await adminClient
    .from('users')
    .insert({
      clerk_user_id: clerkUserId,
      name: input.name,
      email: normalizedEmail,
      phone: input.phone || null,
      role: input.role,
      document_type: input.documentType ?? null,
      document_number: input.documentNumber ?? null,
      country: input.country ?? null,
      city: input.city ?? null,
      is_active: true,
      is_verified: true,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (profileError) {
    // No dejar una identidad huérfana en Clerk si la fila interna no cuajó.
    if (!recoveredExistingAuthUser) {
      await clerk.users.deleteUser(clerkUserId).catch(() => undefined);
    }
    if (profileError.code === '23505') {
      throw new Error('Ya existe una cuenta registrada con ese correo o teléfono.');
    }
    throw new Error(profileError.message);
  }

  const user = created as User;
  await ensureProductAccessAndBalances(user);

  return { user, recoveredExistingAuthUser };
}
