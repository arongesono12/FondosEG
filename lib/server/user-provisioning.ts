import type { UserRole } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthErrorMessage, isDuplicateEmailAuthError } from '@/lib/supabase/auth-errors';

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

interface AuthUserLike {
  id: string;
  created_at?: string;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function buildUserMetadata(input: ProvisionUserInput) {
  return {
    name: input.name,
    phone: input.phone,
    role: input.role,
    document_type: input.documentType ?? null,
    document_number: input.documentNumber ?? null,
    country: input.country ?? null,
    city: input.city ?? null,
  };
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createAdminClient>, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }

    const users = data?.users ?? [];
    const match = users.find((user) => normalizeEmail(user.email ?? '') === normalizedEmail);
    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }
  }

  return null;
}

async function ensureProfileAndBalance(
  adminClient: ReturnType<typeof createAdminClient>,
  authUser: AuthUserLike,
  input: ProvisionUserInput,
  isVerified = true
) {
  const nowIso = new Date().toISOString();
  const normalizedEmail = normalizeEmail(input.email);

  const { error: profileError } = await adminClient.from('users').upsert(
    {
      id: authUser.id,
      name: input.name,
      email: normalizedEmail,
      phone: input.phone,
      role: input.role,
      document_type: input.documentType ?? null,
      document_number: input.documentNumber ?? null,
      country: input.country ?? null,
      city: input.city ?? null,
      is_active: true,
      is_verified: isVerified,
      updated_at: nowIso,
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (input.role === 'gestor') {
    const { error: balanceError } = await adminClient.from('agent_balances').upsert(
      {
        agent_id: authUser.id,
        balance: 0,
        cash_balance: 0,
        currency: 'XAF',
        updated_at: nowIso,
      },
      { onConflict: 'agent_id' }
    );

    if (balanceError) {
      throw new Error(balanceError.message);
    }
  }

  if (input.role === 'cliente') {
    const { error: balanceError } = await adminClient.from('client_balances').upsert(
      {
        client_id: authUser.id,
        balance: 0,
        currency: 'XAF',
        updated_at: nowIso,
      },
      { onConflict: 'client_id' }
    );

    if (balanceError) {
      throw new Error(balanceError.message);
    }
  }
}

export async function provisionPendingUserProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  authUser: AuthUserLike,
  input: ProvisionUserInput
) {
  await ensureProfileAndBalance(adminClient, authUser, input, false);
}

export async function provisionUserAccount(
  adminClient: ReturnType<typeof createAdminClient>,
  input: ProvisionUserInput
) {
  const normalizedEmail = normalizeEmail(input.email);
  const metadata = buildUserMetadata({ ...input, email: normalizedEmail });

  const { data: existingProfileByEmail, error: existingProfileError } = await adminClient
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(existingProfileError.message);
  }

  if (existingProfileByEmail) {
    throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
  }

  const createResult = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!createResult.error && createResult.data.user) {
    await ensureProfileAndBalance(adminClient, createResult.data.user, { ...input, email: normalizedEmail });
    return {
      user: createResult.data.user,
      recoveredExistingAuthUser: false,
    };
  }

  if (!isDuplicateEmailAuthError(createResult.error)) {
    throw new Error(getAuthErrorMessage(createResult.error));
  }

  const existingAuthUser = await findAuthUserByEmail(adminClient, normalizedEmail);
  if (!existingAuthUser) {
    throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
  }

  const { data: existingProfileById, error: profileByIdError } = await adminClient
    .from('users')
    .select('id')
    .eq('id', existingAuthUser.id)
    .maybeSingle();

  if (profileByIdError) {
    throw new Error(profileByIdError.message);
  }

  if (existingProfileById) {
    throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
  }

  const { data: updatedAuthData, error: updateError } = await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (updateError || !updatedAuthData.user) {
    throw new Error(getAuthErrorMessage(updateError));
  }

  await ensureProfileAndBalance(adminClient, updatedAuthData.user, { ...input, email: normalizedEmail });

  return {
    user: updatedAuthData.user,
    recoveredExistingAuthUser: true,
  };
}
