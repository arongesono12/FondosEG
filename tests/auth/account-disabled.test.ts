import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNT_DISABLED_MESSAGE,
  ACCOUNT_DISABLED_PATH,
  isAccountDisabledResponse,
} from '../../lib/account-status.ts';

const root = new URL('../../', import.meta.url);

test('only a 403 carrying the exact disabled message counts as a disabled account', () => {
  assert.equal(isAccountDisabledResponse(403, ACCOUNT_DISABLED_MESSAGE), true);
  assert.equal(isAccountDisabledResponse(403, 'Forbidden'), false);
  assert.equal(isAccountDisabledResponse(401, ACCOUNT_DISABLED_MESSAGE), false);
  assert.equal(isAccountDisabledResponse(403, undefined), false);
});

test('the dashboard layout keeps disabled accounts out of the shell', async () => {
  const layout = await readFile(new URL('app/(dashboard)/layout.tsx', root), 'utf8');

  // Desactivar sólo toca `users.is_active`; si el layout no lo mira, el panel
  // se pinta y cada widget sondea endpoints que responden 403.
  assert.match(layout, /is_active === false/, 'el layout debe comprobar users.is_active');
  assert.match(layout, /redirect\(ACCOUNT_DISABLED_PATH\)/, 'debe enviar a la pantalla de cuenta desactivada');
});

test('the API and the HTTP client share the same disabled-account contract', async () => {
  const authz = await readFile(new URL('lib/server/authz.ts', root), 'utf8');
  const http = await readFile(new URL('services/http.ts', root), 'utf8');

  assert.match(authz, /new AuthzError\(ACCOUNT_DISABLED_MESSAGE, 403\)/);
  assert.match(http, /isAccountDisabledResponse\(res\.status, message\)/);
  assert.match(http, /window\.location\.assign\(ACCOUNT_DISABLED_PATH\)/);
});

test('the disabled-account page lets reactivated accounts back in', async () => {
  const page = await readFile(new URL(`app${ACCOUNT_DISABLED_PATH}/page.tsx`, root), 'utf8');

  // Sin esto, una cuenta reactivada que abra el enlace quedaría atrapada.
  assert.match(page, /is_active !== false/);
  assert.match(page, /redirect\('\/dashboard'\)/);
});
