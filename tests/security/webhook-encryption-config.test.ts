import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  isWebhookEncryptionConfigured,
  WebhookEncryptionConfigError,
} from '../../lib/server/webhook-security.ts';

const root = new URL('../../', import.meta.url);
const load = (path: string) => readFile(new URL(path, root), 'utf8');

function withKey<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (value === undefined) delete process.env.WEBHOOK_ENCRYPTION_KEY;
  else process.env.WEBHOOK_ENCRYPTION_KEY = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.WEBHOOK_ENCRYPTION_KEY;
    else process.env.WEBHOOK_ENCRYPTION_KEY = previous;
  }
}

test('sin clave o con una clave inválida la configuración se detecta como ausente', () => {
  assert.equal(withKey(undefined, isWebhookEncryptionConfigured), false);
  assert.equal(withKey('', isWebhookEncryptionConfigured), false);
  assert.equal(withKey('demasiado-corta', isWebhookEncryptionConfigured), false);
  assert.equal(withKey('generate-at-least-32-random-bytes', isWebhookEncryptionConfigured), false);
});

test('acepta claves de 32 bytes en hex o base64 y cifra de ida y vuelta', () => {
  const hexKey = randomBytes(32).toString('hex');
  const base64Key = randomBytes(32).toString('base64');

  assert.equal(withKey(hexKey, isWebhookEncryptionConfigured), true);
  assert.equal(withKey(base64Key, isWebhookEncryptionConfigured), true);
  assert.equal(
    withKey(hexKey, () => decryptWebhookSecret(encryptWebhookSecret('whsec_abc'))),
    'whsec_abc'
  );
});

test('la falta de clave lanza un error de configuración identificable, no uno genérico', () => {
  assert.throws(() => withKey(undefined, () => encryptWebhookSecret('whsec_abc')), WebhookEncryptionConfigError);
  assert.throws(() => withKey('corta', () => encryptWebhookSecret('whsec_abc')), WebhookEncryptionConfigError);
});

test('crear y rotar webhooks responden 503 con un mensaje claro si falta la clave', async () => {
  for (const path of ['app/api/webhooks/route.ts', 'app/api/webhooks/[id]/rotate/route.ts']) {
    const source = await load(path);
    assert.match(source, /if \(!isWebhookEncryptionConfigured\(\)\)/, path);
    assert.match(source, /WEBHOOK_ENCRYPTION_NOT_CONFIGURED_MESSAGE/, path);
    assert.match(source, /status: 503/, path);
  }
});

test('el outbox no consume reintentos de entrega mientras falte la clave', async () => {
  const outbox = await load('lib/server/webhook-outbox.ts');
  assert.match(outbox, /if \(!isWebhookEncryptionConfigured\(\)\) \{/);
});

test('el arranque avisa si falta la clave', async () => {
  const nodeChecks = await load('instrumentation-node.ts');
  assert.match(nodeChecks, /isWebhookEncryptionConfigured/);
});

test('el código con crypto solo se importa dentro de la rama nodejs (el bundle edge no lo resuelve)', async () => {
  const instrumentation = await load('instrumentation.ts');
  // El import tiene que estar dentro del if, no después de un `return`.
  assert.match(
    instrumentation,
    /if \(process\.env\.NEXT_RUNTIME === 'nodejs'\) \{\s+await import\('\.\/instrumentation-node'\);\s+\}/
  );
  assert.doesNotMatch(instrumentation, /webhook-security/);
});
