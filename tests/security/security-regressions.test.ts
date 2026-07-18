import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('authorization never falls back to unverified getSession state', async () => {
  const source = await readFile(new URL('lib/server/authz.ts', root), 'utf8');
  assert.doesNotMatch(source, /\.auth\.getSession\s*\(/);
});

test('security migration uses atomic upserts and restricted execution', async () => {
  const sql = await readFile(
    new URL('supabase/migrations/20260717_security_concurrency_hardening.sql', root),
    'utf8'
  );
  assert.match(sql, /ON CONFLICT \(api_key_id, window_started_at\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
  assert.match(sql, /SET search_path = public, pg_temp/);
});

test('tracked-secret extensions remain ignored', async () => {
  const ignore = await readFile(new URL('.gitignore', root), 'utf8');
  for (const pattern of ['*.key', '*.der', '*.csr', 'verification-code-*.md']) {
    assert.match(ignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('public signup rejects privileged roles in the server action', async () => {
  const source = await readFile(new URL('app/actions/auth.ts', root), 'utf8');
  assert.match(source, /data\.role !== 'cliente'/);
});

test('dashboard and developer portal use independent product grants', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260718_separate_product_access.sql', root), 'utf8');
  const apiKeys = await readFile(new URL('app/api/api-keys/route.ts', root), 'utf8');
  assert.match(migration, /UNIQUE \(user_id, product\)/);
  assert.match(migration, /WHERE role IN \('admin', 'superadmin'\)/);
  assert.match(apiKeys, /requireDeveloperAccess\(\)/);
  assert.match(apiKeys, /isApplicationAdmin \? requestedEnvironment : 'test'/);
});

test('CSP permits Next development tooling without weakening production', async () => {
  const source = await readFile(new URL('next.config.ts', root), 'utf8');
  assert.match(source, /isDevelopment \? " 'unsafe-eval'" : ""/);
  assert.match(source, /process\.env\.NODE_ENV !== "production"/);
});

test('landing content is visible before client hydration', async () => {
  const source = await readFile(new URL('components/marketing/motion-elements.tsx', root), 'utf8');
  assert.doesNotMatch(source, /initial="hidden"/);
  assert.match(source, /initial=\{false\}/);
});
