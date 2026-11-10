/**
 * Contrato compartido entre servidor y cliente para las cuentas desactivadas.
 *
 * `requireProfile()` responde 403 con este mensaje exacto cuando
 * `users.is_active` es `false`; el cliente HTTP lo reconoce para sacar al
 * usuario del panel en lugar de seguir sondeando endpoints que nunca
 * responderán otra cosa.
 */
export const ACCOUNT_DISABLED_MESSAGE = 'Account disabled';

/** Pantalla informativa a la que se envía a una cuenta desactivada. */
export const ACCOUNT_DISABLED_PATH = '/account-disabled';

export function isAccountDisabledResponse(status: number, message: string | undefined): boolean {
  return status === 403 && message === ACCOUNT_DISABLED_MESSAGE;
}
