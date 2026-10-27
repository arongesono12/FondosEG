import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildWalletLinkReturnUrl,
  canDecideLinkRequest,
  computeAvailableBalance,
  generateWalletLinkCode,
  generateWalletLinkToken,
  hashWalletLinkSecret,
  isWalletLinkToken,
  maskWalletPhone,
  parseCreateWalletLink,
  parseRedeemCode,
} from '../../lib/server/wallet-link-rules.ts';

const root = new URL('../../', import.meta.url);
const load = (path: string) => readFile(new URL(path, root), 'utf8');

test('el token lleva el prefijo del entorno y no se repite', () => {
  const live = generateWalletLinkToken('production');
  const sandbox = generateWalletLinkToken('test');
  assert.match(live, /^wlt_live_[0-9a-f]{48}$/);
  assert.match(sandbox, /^wlt_test_[0-9a-f]{48}$/);
  assert.notEqual(live, generateWalletLinkToken('production'));
  assert.equal(isWalletLinkToken(live), true);
  assert.equal(isWalletLinkToken('sk_live_' + 'a'.repeat(48)), false);
  assert.equal(isWalletLinkToken(undefined), false);
});

test('solo se guarda el hash del código y del token', () => {
  const code = generateWalletLinkCode();
  assert.match(code, /^[0-9a-f]{64}$/);
  const hash = hashWalletLinkSecret(code);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, code);
  assert.equal(hash, hashWalletLinkSecret(code));
});

test('crear vínculo exige usuario, return_url https y state', () => {
  const ok = parseCreateWalletLink({
    externalUserRef: '6f1c2b8e-1111-4111-8111-111111111111',
    returnUrl: 'https://casaseg.com/profile',
    state: 'abcDEF123_-xyz',
  });
  assert.equal(ok.success, true);

  const snake = parseCreateWalletLink({ external_user_ref: 'u1', return_url: 'https://casaseg.com', state: 'abcdefgh' });
  assert.equal(snake.success, true);

  for (const input of [
    { externalUserRef: 'u1', returnUrl: 'http://casaseg.com/profile', state: 'abcdefgh' },
    { externalUserRef: 'u1', returnUrl: 'javascript:alert(1)', state: 'abcdefgh' },
    { externalUserRef: '', returnUrl: 'https://casaseg.com', state: 'abcdefgh' },
    { externalUserRef: 'u1', returnUrl: 'https://casaseg.com', state: 'corto' },
    { externalUserRef: 'u1', returnUrl: 'https://casaseg.com', state: 'con espacios y <html>' },
  ]) {
    assert.equal(parseCreateWalletLink(input).success, false, JSON.stringify(input));
  }
});

test('el canje solo acepta un código con el formato generado', () => {
  assert.equal(parseRedeemCode({ code: generateWalletLinkCode() }).success, true);
  assert.equal(parseRedeemCode({ code: 'abc' }).success, false);
  assert.equal(parseRedeemCode({ code: 'g'.repeat(64) }).success, false);
  assert.equal(parseRedeemCode(null).success, false);
});

test('solo se decide una solicitud pendiente y sin caducar', () => {
  const now = new Date('2026-10-23T10:00:00Z');
  const future = '2026-10-23T10:10:00Z';
  const past = '2026-10-23T09:59:59Z';
  assert.equal(canDecideLinkRequest({ status: 'pending', expires_at: future }, now), true);
  assert.equal(canDecideLinkRequest({ status: 'pending', expires_at: past }, now), false);
  for (const status of ['approved', 'denied', 'consumed'] as const) {
    assert.equal(canDecideLinkRequest({ status, expires_at: future }, now), false, status);
  }
});

test('la vuelta al integrador lleva el código o el rechazo y su state', () => {
  const approved = new URL(buildWalletLinkReturnUrl('https://casaseg.com/profile?tab=pagos', { code: 'c0de' }, 'st4te-123') ?? '');
  assert.equal(approved.searchParams.get('fondoseg_link'), 'c0de');
  assert.equal(approved.searchParams.get('state'), 'st4te-123');
  assert.equal(approved.searchParams.get('tab'), 'pagos');

  const denied = new URL(buildWalletLinkReturnUrl('https://casaseg.com/profile', { error: 'denied' }, 'st4te-123') ?? '');
  assert.equal(denied.searchParams.get('fondoseg_link_error'), 'denied');
  assert.equal(denied.searchParams.get('fondoseg_link'), null);

  assert.equal(buildWalletLinkReturnUrl('http://evil.example', { code: 'x' }, 'st4te-123'), null);
});

test('el comercio solo ve los 4 últimos dígitos del teléfono', () => {
  assert.equal(maskWalletPhone('+240 222 000 111'), '•••• 0111');
  assert.equal(maskWalletPhone('12'), null);
  assert.equal(maskWalletPhone(null), null);
});

test('el saldo disponible descuenta lo reservado', () => {
  assert.equal(computeAvailableBalance({ balance: '400000', reserved_balance: '50000' }), 350000);
  assert.equal(computeAvailableBalance({ balance: 1000 }), 1000);
  assert.equal(computeAvailableBalance(null), 0);
});

test('las tablas de vínculos solo son accesibles para el backend', async () => {
  const sql = await load('supabase/migrations/20261023_wallet_links.sql');
  for (const table of ['wallet_link_requests', 'wallet_links']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`REVOKE ALL ON public\\.${table} FROM PUBLIC, anon, authenticated`));
  }
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/);
  // Rotar o borrar la API key no puede borrar en cascada los vínculos de los clientes.
  assert.doesNotMatch(sql, /api_keys\(id\) ON DELETE CASCADE/);
  assert.match(sql, /api_key_id UUID REFERENCES public\.api_keys\(id\) ON DELETE SET NULL/);
  assert.doesNotMatch(sql, /access_token/);
  assert.match(sql, /scopes <@ ARRAY\['balance:read'\]/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.redeem_wallet_link_code\(TEXT, UUID, UUID, TEXT\) TO service_role/);
});

test('el canje bloquea la solicitud y no distingue códigos ajenos', async () => {
  const sql = await load('supabase/migrations/20261023_wallet_links.sql');
  assert.match(sql, /WHERE code_hash = p_code_hash\s+FOR UPDATE/);
  assert.match(sql, /NOT FOUND OR v_request\.merchant_user_id <> p_merchant_user_id/);
});

test('las rutas de saldo exigen la API key y el token del vínculo', async () => {
  const balance = await load('app/api/external/wallet-links/balance/route.ts');
  assert.match(balance, /authorizePaymentsKey/);
  assert.match(balance, /x-wallet-link-token/);
  assert.match(balance, /findActiveWalletLinkByToken\(token, apiKey\.user_id\)/);
  assert.match(balance, /'link_revoked'/);

  const decide = await load('app/api/wallet-links/requests/[id]/route.ts');
  assert.match(decide, /isAllowedSameOriginMutation/);
  assert.match(decide, /requireProfile/);
});

test('solo una aplicación verificada por el superadmin pide vínculos', async () => {
  const service = await load('lib/server/wallet-links.ts');
  assert.match(service, /\.select\('issued_by_user_id, application_id'\)/);
  // Con aplicación: solo si es de confianza (creada por el superadmin).
  assert.match(service, /application\?\.status === 'active' && application\.is_trusted === true/);
  // Credenciales anteriores a las aplicaciones: la regla de siempre.
  assert.match(service, /trusted = Boolean\(key\?\.issued_by_user_id\)/);

  const consent = await load('components/payments/wallet-link-consent.tsx');
  assert.match(consent, /props\.destinationHost/);
});
