/**
 * Reglas de las credenciales y webhooks de integradores.
 *
 * Cada credencial pertenece a una APLICACIÓN (p. ej. CasasEG), no a un rol ni
 * a la billetera de una persona. La aplicación tiene su propia billetera de
 * cliente: sus credenciales y webhooks apuntan a ella (`user_id`), así que los
 * cobros se le abonan y los envíos salen de su saldo.
 *
 * Sin imports con alias: lo cargan las rutas y los tests de `node --test`.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const API_PERMISSIONS = ['balance', 'transfer', 'history', 'payments', 'properties'] as const;
export type CredentialPermission = (typeof API_PERMISSIONS)[number];

/** Lo que necesita una app que cobra y paga con billeteras FondosEG. */
export const DEFAULT_APPLICATION_PERMISSIONS: Readonly<Record<CredentialPermission, boolean>> = {
  balance: true,
  transfer: true,
  history: true,
  payments: true,
  properties: false,
};

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Solo administración emite credenciales que mueven dinero real. */
export function canIssueProductionCredentials(actorAccessRole: string): boolean {
  return actorAccessRole === 'admin' || actorAccessRole === 'superadmin';
}

/**
 * Una aplicación creada por el superadmin es de confianza: puede pedir a los
 * clientes ver su saldo (vínculos de billetera). Así nadie da de alta una app
 * con el nombre de otro comercio para engañar a los clientes.
 */
export function isTrustedApplicationCreator(actorAccessRole: string): boolean {
  return actorAccessRole === 'superadmin';
}

/** El superadmin ve y gestiona todas las aplicaciones; el resto, las suyas. */
export function canManageEveryApplication(actorAccessRole: string): boolean {
  return actorAccessRole === 'superadmin';
}

/**
 * Permisos de una credencial nueva: los pedidos explícitamente y, para el
 * resto, los de una app que cobra y paga. Ignora claves desconocidas.
 */
export function normalizeCredentialPermissions(input: unknown): Record<CredentialPermission, boolean> {
  const values = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  return API_PERMISSIONS.reduce<Record<CredentialPermission, boolean>>((acc, key) => ({
    ...acc,
    [key]: typeof values[key] === 'boolean' ? values[key] as boolean : DEFAULT_APPLICATION_PERMISSIONS[key],
  }), { ...DEFAULT_APPLICATION_PERMISSIONS });
}

/**
 * Filtro PostgREST de las credenciales y webhooks que el actor puede ver y
 * gestionar: los de las billeteras de sus aplicaciones, los que operan su
 * propia billetera (anteriores a las aplicaciones) y, para el superadmin, los
 * que emitió para un cliente. Todos los ids se validan como UUID para que
 * nunca puedan inyectar sintaxis en `.or()`.
 */
export function buildOwnedOrIssuedFilter(
  userId: string,
  actorAccessRole: string,
  applicationWalletIds: readonly string[] = []
): string {
  if (!isUuid(userId)) {
    throw new Error('Identificador de usuario inválido');
  }
  if (!applicationWalletIds.every(isUuid)) {
    throw new Error('Identificador de billetera inválido');
  }

  const clauses = [`user_id.eq.${userId}`];
  const walletIds = [...new Set(applicationWalletIds)].filter((id) => id !== userId);
  if (walletIds.length > 0) {
    clauses.push(`user_id.in.(${walletIds.join(',')})`);
  }
  if (canManageEveryApplication(actorAccessRole)) {
    clauses.push('issued_by_user_id.not.is.null');
  }
  return clauses.join(',');
}
