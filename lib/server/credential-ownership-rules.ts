/**
 * Reglas para emitir credenciales y webhooks a nombre de otra billetera.
 *
 * Una integración como CasasEG necesita que la API key y el webhook
 * pertenezcan a la billetera CLIENTE que cobra (solo así FondosEG le abona
 * los cobros y le envía sus eventos), pero solo los administradores tienen
 * acceso al portal de desarrolladores. Un administrador emite la credencial
 * "en nombre de" esa billetera; él queda como emisor y puede gestionarla.
 *
 * Sin imports con alias: lo cargan las rutas y los tests de `node --test`.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OWNER_PHONE_LENGTH = 32;

export type IssuanceDecision =
  | { kind: 'self' }
  | { kind: 'for_client'; ownerPhone: string }
  | { kind: 'rejected'; status: 400 | 403; message: string };

/**
 * Decide para quién se emite. `requestedRole` es `null` para webhooks, que
 * no llevan rol. Sin `ownerPhone`, la credencial es del propio emisor (el
 * comportamiento de siempre).
 */
export function decideIssuance(input: {
  actorAccessRole: string;
  ownerPhone: unknown;
  requestedRole: string | null;
}): IssuanceDecision {
  const ownerPhone = typeof input.ownerPhone === 'string' ? input.ownerPhone.trim() : '';
  if (!ownerPhone) return { kind: 'self' };

  if (input.actorAccessRole !== 'admin' && input.actorAccessRole !== 'superadmin') {
    return { kind: 'rejected', status: 403, message: 'Solo un administrador puede emitir a nombre de otra billetera' };
  }

  if (ownerPhone.length > MAX_OWNER_PHONE_LENGTH || !/\d{6,}/.test(ownerPhone.replace(/\D/g, ''))) {
    return { kind: 'rejected', status: 400, message: 'El teléfono de la billetera titular no es válido' };
  }

  // Una billetera cliente solo puede tener credenciales de cliente: emitirle
  // una de gestor o admin le daría permisos que su cuenta no tiene.
  if (input.requestedRole !== null && input.requestedRole !== 'cliente') {
    return { kind: 'rejected', status: 400, message: 'A una billetera cliente solo se le emiten credenciales con rol cliente' };
  }

  return { kind: 'for_client', ownerPhone };
}

/**
 * Filtro PostgREST "es mío o lo emití yo". El id viene de la sesión, pero se
 * valida como UUID para que nunca pueda inyectar sintaxis en `.or()`.
 */
export function buildOwnedOrIssuedFilter(userId: string): string {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error('Identificador de usuario inválido');
  }
  return `user_id.eq.${userId},issued_by_user_id.eq.${userId}`;
}
