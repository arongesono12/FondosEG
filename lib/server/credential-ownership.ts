import 'server-only';
import { findRegisteredClientByPhone } from '@/lib/server/client-recipient';
import { decideIssuance } from '@/lib/server/credential-ownership-rules';
import { createAdminClient } from '@/lib/supabase/admin';

export { buildOwnedOrIssuedFilter } from '@/lib/server/credential-ownership-rules';

export class CredentialOwnerError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CredentialOwnerError';
    this.status = status;
  }
}

export interface ResolvedCredentialOwner {
  /** Titular: la billetera que opera la key o recibe los eventos. */
  ownerUserId: string;
  /** Administrador que la emitió a nombre del titular; null si es propia. */
  issuedByUserId: string | null;
}

/**
 * Resuelve el titular de una credencial o webhook. Con `ownerPhone`, un
 * administrador la emite para una billetera cliente activa; se busca por
 * coincidencia exacta de teléfono, nunca aproximada.
 */
export async function resolveCredentialOwner(params: {
  actorUserId: string;
  actorAccessRole: string;
  ownerPhone: unknown;
  requestedRole: string | null;
}): Promise<ResolvedCredentialOwner> {
  const decision = decideIssuance(params);

  if (decision.kind === 'rejected') {
    throw new CredentialOwnerError(decision.message, decision.status);
  }
  if (decision.kind === 'self') {
    return { ownerUserId: params.actorUserId, issuedByUserId: null };
  }

  const client = await findRegisteredClientByPhone(createAdminClient(), decision.ownerPhone);
  if (!client) {
    throw new CredentialOwnerError('No existe una billetera cliente activa con ese teléfono', 404);
  }

  return { ownerUserId: client.id, issuedByUserId: params.actorUserId };
}

/**
 * Añade `owner_label` ("Nombre · teléfono") a las filas emitidas para otra
 * billetera, para que el administrador sepa a quién pertenece cada una.
 */
export async function attachOwnerLabels<T extends { user_id?: unknown; issued_by_user_id?: unknown }>(
  rows: T[]
): Promise<Array<T & { owner_label: string | null }>> {
  const ownerIds = [...new Set(
    rows.filter((row) => row.issued_by_user_id).map((row) => String(row.user_id))
  )];

  const labels = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data, error } = await createAdminClient()
      .from('users')
      .select('id, name, phone')
      .in('id', ownerIds);
    if (error) throw new Error(error.message);
    for (const owner of data || []) {
      labels.set(String(owner.id), [owner.name, owner.phone].filter(Boolean).join(' · '));
    }
  }

  return rows.map((row) => ({
    ...row,
    owner_label: row.issued_by_user_id ? labels.get(String(row.user_id)) ?? 'Billetera cliente' : null,
  }));
}
