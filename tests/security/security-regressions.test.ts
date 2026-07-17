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
  assert.match(source, /data\.role !== 'cliente' && data\.role !== 'gestor'/);
});
