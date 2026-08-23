import 'server-only';

import { getPhoneLookupCandidates, normalizePhoneDigits } from '@/lib/utils';
import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export type RegisteredClientRecipient = {
  id: string;
  name: string;
  phone: string | null;
};

type CandidateRow = RegisteredClientRecipient & { is_active?: boolean | null };

/**
 * Una cuenta desactivada no puede entrar al panel (`requireProfile` la rechaza
 * con "Account disabled"), así que su titular no podría ni ver el saldo ni
 * emitir un código de retiro. Acreditarle el envío dejaría el dinero encerrado
 * en una billetera inalcanzable; como envío de ventanilla, en cambio, sigue
 * siendo cobrable en mano con el código.
 *
 * Se compara contra `false` y no contra `true` porque la columna admite NULL en
 * las filas heredadas, y un NULL significa "activo" (el DEFAULT de la tabla).
 */
function isUsableAccount(user: CandidateRow): boolean {
  return user.is_active !== false;
}

/**
 * Vincula un teléfono de beneficiario con un cliente registrado sin aceptar
 * coincidencias aproximadas. Si el teléfono no se puede resolver con certeza,
 * la transferencia sigue siendo de ventanilla y no toca una billetera ajena.
 *
 * Devolver un cliente aquí ya no sólo acredita saldo: LIQUIDA el envío contra
 * su billetera y anula el código de ventanilla. Por eso el criterio tiene que
 * ser "esta persona puede gestionar el dinero por sí misma", no sólo "existe
 * una fila con este teléfono".
 */
export async function findRegisteredClientByPhone(
  adminClient: AdminClient,
  phone: string
): Promise<RegisteredClientRecipient | null> {
  const normalizedInput = normalizePhoneDigits(phone || '');
  if (!normalizedInput) return null;

  const lookupCandidates = getPhoneLookupCandidates(phone);
  if (lookupCandidates.length > 0) {
    const { data, error } = await adminClient
      .from('users')
      .select('id, name, phone, is_active')
      .eq('role', 'cliente')
      .in('phone', lookupCandidates)
      .limit(10);

    if (error) throw new Error(error.message);

    const exactMatch = ((data || []) as CandidateRow[]).find(
      (user) => normalizePhoneDigits(user.phone || '') === normalizedInput
    );
    if (exactMatch) {
      return isUsableAccount(exactMatch)
        ? { id: exactMatch.id, name: exactMatch.name, phone: exactMatch.phone }
        : null;
    }
  }

  // Los teléfonos heredados pueden tener puntuación no incluida en los
  // candidatos. Se conserva el fallback, pero siempre se compara por todos
  // los dígitos: nunca se devuelve arbitrariamente la primera coincidencia.
  const { data: clients, error } = await adminClient
    .from('users')
    .select('id, name, phone, is_active')
    .eq('role', 'cliente');

  if (error) throw new Error(error.message);

  const match = ((clients || []) as CandidateRow[]).find(
    (user) => normalizePhoneDigits(user.phone || '') === normalizedInput
  );

  if (!match || !isUsableAccount(match)) return null;

  return { id: match.id, name: match.name, phone: match.phone };
}
