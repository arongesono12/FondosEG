import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildOwnedOrIssuedFilter,
  decideIssuance,
} from '../../lib/server/credential-ownership-rules.ts';

const root = new URL('../../', import.meta.url);
const load = (path: string) => readFile(new URL(path, root), 'utf8');
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';

test('sin teléfono titular la credencial es del propio emisor', () => {
  assert.deepEqual(decideIssuance({ actorAccessRole: 'cliente', ownerPhone: '', requestedRole: 'cliente' }), { kind: 'self' });
  assert.deepEqual(decideIssuance({ actorAccessRole: 'admin', ownerPhone: undefined, requestedRole: 'gestor' }), { kind: 'self' });
});

test('solo el superadmin emite a nombre de una billetera cliente', () => {
  assert.deepEqual(
    decideIssuance({ actorAccessRole: 'superadmin', ownerPhone: ' +240 222 000 111 ', requestedRole: 'cliente' }),
    { kind: 'for_client', ownerPhone: '+240 222 000 111' }
  );
  // Los webhooks no tienen rol.
  assert.equal(decideIssuance({ actorAccessRole: 'superadmin', ownerPhone: '222000111', requestedRole: null }).kind, 'for_client');
});

test('ni un admin ni un cliente pueden emitir para otra billetera', () => {
  for (const actorAccessRole of ['admin', 'gestor', 'cliente']) {
    const decision = decideIssuance({ actorAccessRole, ownerPhone: '222000111', requestedRole: 'cliente' });
    assert.equal(decision.kind, 'rejected', actorAccessRole);
    assert.equal(decision.kind === 'rejected' && decision.status, 403, actorAccessRole);
  }
  // El webhook de la billetera cliente tampoco.
  assert.equal(decideIssuance({ actorAccessRole: 'admin', ownerPhone: '222000111', requestedRole: null }).kind, 'rejected');
});

test('a una billetera cliente no se le emiten roles de gestor o admin', () => {
  for (const role of ['gestor', 'admin', 'superadmin']) {
    const decision = decideIssuance({ actorAccessRole: 'superadmin', ownerPhone: '222000111', requestedRole: role });
    assert.equal(decision.kind, 'rejected', role);
    assert.equal(decision.kind === 'rejected' && decision.status, 400, role);
  }
});

test('rechaza teléfonos titulares inválidos', () => {
  for (const ownerPhone of ['abc', '1'.repeat(40)]) {
    const decision = decideIssuance({ actorAccessRole: 'superadmin', ownerPhone, requestedRole: 'cliente' });
    assert.equal(decision.kind === 'rejected' && decision.status, 400, ownerPhone);
  }
});

test('solo el superadmin ve y gestiona las credenciales emitidas para clientes', () => {
  assert.equal(
    buildOwnedOrIssuedFilter(ADMIN_ID, 'superadmin'),
    `user_id.eq.${ADMIN_ID},issued_by_user_id.not.is.null`
  );
  // Un admin, aunque las emitiera antes de esta regla, solo ve las suyas.
  assert.equal(buildOwnedOrIssuedFilter(ADMIN_ID, 'admin'), `user_id.eq.${ADMIN_ID}`);
  assert.equal(buildOwnedOrIssuedFilter(ADMIN_ID, 'cliente'), `user_id.eq.${ADMIN_ID}`);
});

test('el filtro de credenciales no admite inyección en .or()', () => {
  assert.throws(() => buildOwnedOrIssuedFilter('x,role.eq.admin', 'superadmin'));
});

test('las rutas de credenciales y webhooks usan el titular resuelto y el filtro de emisor', async () => {
  const keys = await load('app/api/api-keys/route.ts');
  assert.match(keys, /resolveCredentialOwner\(/);
  assert.match(keys, /issued_by_user_id: owner\.issuedByUserId/);
  assert.match(keys, /buildOwnedOrIssuedFilter\(user\.id, access\.access_role\)/);

  const webhooks = await load('app/api/webhooks/route.ts');
  assert.match(webhooks, /resolveCredentialOwner\(/);
  assert.match(webhooks, /user_id: owner\.ownerUserId/);

  for (const path of [
    'app/api/api-keys/[id]/rotate/route.ts',
    'app/api/api-keys/usage/route.ts',
    'app/api/webhooks/[id]/route.ts',
    'app/api/webhooks/[id]/rotate/route.ts',
  ]) {
    assert.match(await load(path), /buildOwnedOrIssuedFilter\(user\.id, access\.access_role\)/, path);
  }
});

test('el portal solo muestra "Billetera titular" al superadmin', async () => {
  const page = await load('app/(dashboard)/developers/page.tsx');
  assert.match(page, /isSuperAdminRole\(user\?\.role\) && \(\s*<div className="grid gap-2">\s*<Label htmlFor="owner_phone">/);
  assert.match(page, /canIssueForClient=\{isSuperAdminRole\(user\?\.role\)\}/);
});

test('la migración añade el emisor a credenciales y webhooks', async () => {
  const sql = await load('supabase/migrations/20261015_credentials_issued_for_client.sql');
  assert.match(sql, /ALTER TABLE public\.api_keys\s+ADD COLUMN IF NOT EXISTS issued_by_user_id UUID/);
  assert.match(sql, /ALTER TABLE public\.webhook_subscriptions\s+ADD COLUMN IF NOT EXISTS issued_by_user_id UUID/);
});
