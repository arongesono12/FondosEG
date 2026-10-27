import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  canDecideLinkRequest,
  computeAvailableBalance,
  generateWalletLinkCode,
  generateWalletLinkToken,
  hashWalletLinkSecret,
  maskWalletPhone,
  WALLET_LINK_CODE_TTL_MINUTES,
  WALLET_LINK_REQUEST_TTL_MINUTES,
  type NormalizedWalletLinkInput,
  type WalletLinkRequestStatus,
} from '@/lib/server/wallet-link-rules';

/**
 * Acceso a datos de los vínculos de billetera. Las reglas viven en
 * `wallet-link-rules.ts`; el canje atómico del código, en la RPC
 * `redeem_wallet_link_code`.
 */

const REQUEST_SELECT =
  'id, api_key_id, merchant_user_id, merchant_name, external_user_ref, return_url, state, payer_user_id, status, expires_at, created_at';
const LINK_SELECT =
  'id, api_key_id, merchant_user_id, merchant_name, payer_user_id, external_user_ref, scopes, created_at, last_used_at, revoked_at';

export interface StoredWalletLinkRequest {
  id: string;
  api_key_id: string;
  merchant_user_id: string;
  merchant_name: string;
  external_user_ref: string;
  return_url: string;
  state: string;
  payer_user_id: string | null;
  status: WalletLinkRequestStatus;
  expires_at: string;
  created_at: string;
}

export interface StoredWalletLink {
  id: string;
  api_key_id: string;
  merchant_user_id: string;
  merchant_name: string;
  payer_user_id: string;
  external_user_ref: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** Regla de negocio que impide la operación (400/409, no 500). */
export class WalletLinkRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletLinkRejectedError';
  }
}

export async function createWalletLinkRequest(params: {
  apiKeyId: string;
  merchantUserId: string;
  input: NormalizedWalletLinkInput;
}): Promise<StoredWalletLinkRequest> {
  const adminClient = createAdminClient();
  const { data: merchant, error: merchantError } = await adminClient
    .from('users')
    .select('id, name, role')
    .eq('id', params.merchantUserId)
    .maybeSingle();

  if (merchantError) throw new Error(merchantError.message);
  if (!merchant || merchant.role !== 'cliente') {
    throw new WalletLinkRejectedError('La credencial debe pertenecer a una billetera de cliente para vincular billeteras');
  }

  // Solo una aplicación dada de alta por el superadmin puede pedir ver saldos:
  // así nadie registra una app con el nombre de otro comercio para engañar a
  // los clientes en la pantalla de consentimiento. Las credenciales anteriores
  // a las aplicaciones conservan la regla de siempre (emitidas por él).
  const { data: key, error: keyError } = await adminClient
    .from('api_keys')
    .select('issued_by_user_id, application_id')
    .eq('id', params.apiKeyId)
    .maybeSingle();

  if (keyError) throw new Error(keyError.message);

  let trusted = false;
  if (key?.application_id) {
    const { data: application, error: applicationError } = await adminClient
      .from('api_applications')
      .select('is_trusted, status')
      .eq('id', key.application_id)
      .maybeSingle();
    if (applicationError) throw new Error(applicationError.message);
    trusted = application?.status === 'active' && application.is_trusted === true;
  } else {
    trusted = Boolean(key?.issued_by_user_id);
  }

  if (!trusted) {
    throw new WalletLinkRejectedError('Solo las aplicaciones verificadas por FondosEG pueden vincular billeteras. Pide al superadmin que dé de alta tu aplicación.');
  }

  const { data, error } = await adminClient
    .from('wallet_link_requests')
    .insert({
      api_key_id: params.apiKeyId,
      merchant_user_id: params.merchantUserId,
      merchant_name: merchant.name || 'Comercio FondosEG',
      external_user_ref: params.input.externalUserRef,
      return_url: params.input.returnUrl,
      state: params.input.state,
      expires_at: new Date(Date.now() + WALLET_LINK_REQUEST_TTL_MINUTES * 60_000).toISOString(),
    })
    .select(REQUEST_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message || 'No se pudo crear la solicitud de vínculo');
  return data as StoredWalletLinkRequest;
}

export async function findWalletLinkRequestById(id: string): Promise<StoredWalletLinkRequest | null> {
  const { data, error } = await createAdminClient()
    .from('wallet_link_requests')
    .select(REQUEST_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as StoredWalletLinkRequest | null) ?? null;
}

/**
 * El cliente autoriza o rechaza. Al autorizar se genera el código de un solo
 * uso (solo se guarda su hash). La condición de estado va en el UPDATE para
 * que dos clics simultáneos no generen dos códigos.
 */
export async function decideWalletLinkRequest(params: {
  request: StoredWalletLinkRequest;
  payerUserId: string;
  approve: boolean;
}): Promise<{ code: string | null }> {
  const { request, payerUserId, approve } = params;
  if (!canDecideLinkRequest(request)) {
    throw new WalletLinkRejectedError('Esta solicitud de vínculo ya no está disponible');
  }
  if (request.merchant_user_id === payerUserId) {
    throw new WalletLinkRejectedError('No puedes vincular tu billetera con tu propio comercio');
  }

  const now = new Date();
  const code = approve ? generateWalletLinkCode() : null;
  const { data, error } = await createAdminClient()
    .from('wallet_link_requests')
    .update(
      approve
        ? {
          status: 'approved',
          payer_user_id: payerUserId,
          code_hash: hashWalletLinkSecret(code as string),
          code_expires_at: new Date(now.getTime() + WALLET_LINK_CODE_TTL_MINUTES * 60_000).toISOString(),
          decided_at: now.toISOString(),
        }
        : { status: 'denied', payer_user_id: payerUserId, decided_at: now.toISOString() }
    )
    .eq('id', request.id)
    .eq('status', 'pending')
    .gt('expires_at', now.toISOString())
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new WalletLinkRejectedError('Esta solicitud de vínculo ya no está disponible');
  return { code };
}

const REDEEM_ERRORS: Array<[RegExp, string]> = [
  [/code is invalid/i, 'El código de vínculo no es válido'],
  [/already used/i, 'El código de vínculo ya se utilizó'],
  [/has expired/i, 'El código de vínculo ha caducado'],
];

/** Canjea el código por el token. El token en claro solo existe en esta respuesta. */
export async function redeemWalletLinkCode(params: {
  code: string;
  merchantUserId: string;
  apiKeyId: string;
  environment: string;
}): Promise<{
  link_id: string;
  access_token: string;
  scopes: string[];
  external_user_ref: string;
  wallet_phone_masked: string | null;
}> {
  const accessToken = generateWalletLinkToken(params.environment);
  const { data, error } = await createAdminClient().rpc('redeem_wallet_link_code', {
    p_code_hash: hashWalletLinkSecret(params.code),
    p_merchant_user_id: params.merchantUserId,
    p_api_key_id: params.apiKeyId,
    p_token_hash: hashWalletLinkSecret(accessToken),
  });

  if (error) {
    const known = REDEEM_ERRORS.find(([pattern]) => pattern.test(error.message));
    if (known) throw new WalletLinkRejectedError(known[1]);
    throw new Error(error.message);
  }

  const result = data as { link_id: string; scopes: string[]; external_user_ref: string; payer_phone: string | null };
  return {
    link_id: result.link_id,
    access_token: accessToken,
    scopes: result.scopes,
    // El integrador comprueba que el vínculo es del usuario que lo inició.
    external_user_ref: result.external_user_ref,
    wallet_phone_masked: maskWalletPhone(result.payer_phone),
  };
}

/** Vínculo activo del comercio para ese token, o null si no existe o se revocó. */
export async function findActiveWalletLinkByToken(
  token: string,
  merchantUserId: string
): Promise<StoredWalletLink | null> {
  const { data, error } = await createAdminClient()
    .from('wallet_links')
    .select(LINK_SELECT)
    .eq('token_hash', hashWalletLinkSecret(token))
    .eq('merchant_user_id', merchantUserId)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as StoredWalletLink | null) ?? null;
}

export async function readWalletLinkBalance(link: StoredWalletLink): Promise<{
  available: number;
  currency: string;
  as_of: string;
}> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('client_balances')
    .select('balance, reserved_balance, currency')
    .eq('client_id', link.payer_user_id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const asOf = new Date().toISOString();
  // Un fallo al registrar el uso no debe impedir la lectura.
  await adminClient.from('wallet_links').update({ last_used_at: asOf }).eq('id', link.id);

  return {
    available: computeAvailableBalance(data),
    currency: data?.currency || 'XAF',
    as_of: asOf,
  };
}

/** Revoca un vínculo activo del comercio o del cliente indicado. */
export async function revokeWalletLink(params: {
  linkId: string;
  by: 'payer' | 'merchant';
  ownerUserId: string;
}): Promise<StoredWalletLink | null> {
  const column = params.by === 'payer' ? 'payer_user_id' : 'merchant_user_id';
  const { data, error } = await createAdminClient()
    .from('wallet_links')
    .update({ revoked_at: new Date().toISOString(), revoked_by: params.by })
    .eq('id', params.linkId)
    .eq(column, params.ownerUserId)
    .is('revoked_at', null)
    .select(LINK_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as StoredWalletLink | null) ?? null;
}

export async function listActiveWalletLinksForPayer(payerUserId: string): Promise<StoredWalletLink[]> {
  const { data, error } = await createAdminClient()
    .from('wallet_links')
    .select(LINK_SELECT)
    .eq('payer_user_id', payerUserId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as StoredWalletLink[];
}
