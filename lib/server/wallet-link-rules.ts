import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { isSafeReturnUrl } from './payment-requests-contract.ts';

/**
 * Reglas de los vínculos de billetera: un integrador (p. ej. CasasEG) obtiene,
 * con el consentimiento del cliente, un token que SOLO permite leer el saldo
 * de su billetera. FondosEG guarda únicamente el hash del código y del token.
 *
 * Sin imports con alias `@/`: lo cargan las rutas y los tests de `node --test`.
 */

export const WALLET_LINK_REQUEST_TTL_MINUTES = 15;
export const WALLET_LINK_CODE_TTL_MINUTES = 10;
export const WALLET_LINK_SCOPES = ['balance:read'] as const;

const CODE_PATTERN = /^[0-9a-f]{64}$/;
const TOKEN_PATTERN = /^wlt_(live|test)_[0-9a-f]{48}$/;
const STATE_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function generateWalletLinkCode(): string {
  return randomBytes(32).toString('hex');
}

export function generateWalletLinkToken(environment: string): string {
  const prefix = environment === 'production' ? 'wlt_live_' : 'wlt_test_';
  return `${prefix}${randomBytes(24).toString('hex')}`;
}

export function hashWalletLinkSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isWalletLinkToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

export interface NormalizedWalletLinkInput {
  externalUserRef: string;
  returnUrl: string;
  state: string;
}

const optionalText = (max: number) => z.string().trim().max(max).nullish();

const rawCreateSchema = z.object({
  externalUserRef: optionalText(100),
  external_user_ref: optionalText(100),
  returnUrl: optionalText(500),
  return_url: optionalText(500),
  state: z.string().trim(),
});

export type WalletLinkParseResult<T> =
  | { success: true; data: T }
  | { success: false; details: Record<string, string[]> };

export function parseCreateWalletLink(input: unknown): WalletLinkParseResult<NormalizedWalletLinkInput> {
  const parsed = rawCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, details: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const raw = parsed.data;
  const externalUserRef = (raw.externalUserRef || raw.external_user_ref || '').trim();
  const returnUrl = (raw.returnUrl || raw.return_url || '').trim();
  const details: Record<string, string[]> = {};
  if (!externalUserRef) details.externalUserRef = ['externalUserRef es obligatorio'];
  if (!returnUrl || !isSafeReturnUrl(returnUrl)) details.returnUrl = ['returnUrl debe ser una URL https'];
  if (!STATE_PATTERN.test(raw.state)) details.state = ['state debe tener 8-128 caracteres [A-Za-z0-9_-]'];
  if (Object.keys(details).length > 0) return { success: false, details };

  return { success: true, data: { externalUserRef, returnUrl, state: raw.state } };
}

export function parseRedeemCode(input: unknown): WalletLinkParseResult<{ code: string }> {
  const code = typeof input === 'object' && input !== null ? (input as { code?: unknown }).code : undefined;
  if (typeof code !== 'string' || !CODE_PATTERN.test(code.trim())) {
    return { success: false, details: { code: ['code no es valido'] } };
  }
  return { success: true, data: { code: code.trim() } };
}

export type WalletLinkRequestStatus = 'pending' | 'approved' | 'denied' | 'consumed';

/** Una solicitud solo se puede decidir mientras está pendiente y sin caducar. */
export function canDecideLinkRequest(
  request: { status: WalletLinkRequestStatus; expires_at: string },
  now: Date = new Date()
): boolean {
  return request.status === 'pending' && new Date(request.expires_at).getTime() > now.getTime();
}

/** Vuelta al integrador: `fondoseg_link=<code>` o `fondoseg_link_error=denied`, más su `state`. */
export function buildWalletLinkReturnUrl(
  returnUrl: string,
  outcome: { code: string } | { error: 'denied' },
  state: string
): string | null {
  if (!isSafeReturnUrl(returnUrl)) return null;
  const url = new URL(returnUrl);
  if ('code' in outcome) url.searchParams.set('fondoseg_link', outcome.code);
  else url.searchParams.set('fondoseg_link_error', outcome.error);
  url.searchParams.set('state', state);
  return url.toString();
}

export function buildWalletLinkAuthorizeUrl(baseUrl: string, requestId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/link/${encodeURIComponent(requestId)}`;
}

/** El integrador solo ve los 4 últimos dígitos del teléfono del cliente. */
export function maskWalletPhone(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `•••• ${digits.slice(-4)}`;
}

export function computeAvailableBalance(row: { balance?: unknown; reserved_balance?: unknown } | null): number {
  if (!row) return 0;
  return Number(row.balance || 0) - Number(row.reserved_balance || 0);
}
