import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildOwnedOrIssuedFilter,
  canIssueProductionCredentials,
  isTrustedApplicationCreator,
  normalizeCredentialPermissions,
} from '../../lib/server/credential-ownership-rules.ts';

const root = new URL('../../', import.meta.url);
const load = (path: string) => readFile(new URL(path, root), 'utf8');
const ACTOR = '11111111-1111-4111-8111-111111111111';
const WALLET = '22222222-2222-4222-8222-222222222222';

test('el filtro incluye las billeteras de las aplicaciones del actor', () => {
  assert.equal(buildOwnedOrIssuedFilter(ACTOR, 'cliente'), `user_id.eq.${ACTOR}`);
  assert.equal(buildOwnedOrIssuedFilter(ACTOR, 'admin', [WALLET]), `user_id.eq.${ACTOR},user_id.in.(${WALLET})`);
  assert.equal(
    buildOwnedOrIssuedFilter(ACTOR, 'superadmin', [WALLET]),
    `user_id.eq.${ACTOR},user_id.in.(${WALLET}),issued_by_user_id.not.is.null`
  );
});

test('el filtro no admite inyección en .or()', () => {
  assert.throws(() => buildOwnedOrIssuedFilter('x,role.eq.admin', 'superadmin'));
  assert.throws(() => buildOwnedOrIssuedFilter(ACTOR, 'admin', ['x),role.eq.admin']));
});

test('producción solo para administración; confianza solo para el superadmin', () => {
  assert.equal(canIssueProductionCredentials('cliente'), false);
  assert.equal(canIssueProductionCredentials('admin'), true);
  assert.equal(isTrustedApplicationCreator('admin'), false);
  assert.equal(isTrustedApplicationCreator('superadmin'), true);
});

test('los permisos por defecto son los de una app que cobra y paga', () => {
  assert.deepEqual(normalizeCredentialPermissions(undefined), {
    balance: true, transfer: true, history: true, payments: true, properties: false,
  });
  assert.equal(normalizeCredentialPermissions({ transfer: false, admin: true }).transfer, false);
  assert.equal('admin' in normalizeCredentialPermissions({ admin: true }), false);
});

test('las credenciales se emiten para una aplicación, sin rol ni teléfono', async () => {
  const keys = await load('app/api/api-keys/route.ts');
  assert.match(keys, /requireVisibleApplication\(parsed\.data\.application_id/);
  assert.match(keys, /user_id: application\.wallet_user_id/);
  assert.doesNotMatch(keys, /owner_phone/);

  const webhooks = await load('app/api/webhooks/route.ts');
  assert.match(webhooks, /user_id: application\.wallet_user_id/);
  assert.doesNotMatch(webhooks, /owner_phone/);

  for (const path of [
    'app/api/api-keys/[id]/rotate/route.ts',
    'app/api/api-keys/usage/route.ts',
    'app/api/webhooks/[id]/route.ts',
    'app/api/webhooks/[id]/rotate/route.ts',
  ]) {
    assert.match(await load(path), /buildCredentialScopeFilter\(user\.id, access\.access_role\)/, path);
  }
});

test('el envío por API usa el mismo flujo normalizado que el panel', async () => {
  const route = await load('app/api/external/wallet-transfer/route.ts');
  assert.match(route, /settleClientWalletTransfer\(/);
  assert.doesNotMatch(route, /createWalletTransferDirectOperation/);
  const history = await load('app/api/external/history/route.ts');
  assert.doesNotMatch(history, /\.select\('[^']*verification_code/);
  assert.match(history, /toPublicWalletMovement\(row, user_id\)/);
});

test('la migración crea aplicaciones con billetera propia que puede cobrar', async () => {
  const sql = await load('supabase/migrations/20261026_api_applications.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.api_applications/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_api_application/);
  assert.match(sql, /FROM public\.api_applications\s+WHERE wallet_user_id = v_receiver\.id/);
});
