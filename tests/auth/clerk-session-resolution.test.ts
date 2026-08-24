import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('linked profiles resolve from the verified Clerk session without fetching the Clerk user', async () => {
  const authz = await readFile(new URL('lib/server/authz.ts', root), 'utf8');
  const identity = await readFile(new URL('lib/server/clerk-identity.ts', root), 'utf8');

  assert.match(authz, /getClerkUserId\(\)/);
  assert.match(authz, /resolveInternalUserByClerkId\(clerkUserId\)/);

  const linkedLookup = authz.indexOf('resolveInternalUserByClerkId(clerkUserId)');
  const clerkLookup = authz.indexOf('getClerkIdentity()');
  assert.ok(linkedLookup !== -1 && clerkLookup !== -1 && linkedLookup < clerkLookup,
    'la consulta remota a Clerk debe quedar sólo como alternativa para perfiles aún no vinculados');

  assert.match(identity, /const \{ userId \} = await auth\(\)/);
  assert.match(identity, /\.eq\('clerk_user_id', clerkUserId\)/);
});
