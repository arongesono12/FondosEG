import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const WEBHOOK_SECRET_PREFIX = 'whsec_';
const WEBHOOK_ALGORITHM = 'aes-256-gcm';

function readEncryptionKey(): Buffer {
  const raw = process.env.WEBHOOK_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY is required to manage webhook secrets');
  }

  const trimmed = raw.trim();

  const asHex = /^[0-9a-fA-F]{64}$/.test(trimmed) ? Buffer.from(trimmed, 'hex') : null;
  if (asHex?.length === 32) return asHex;

  try {
    const asBase64 = Buffer.from(trimmed, 'base64');
    if (asBase64.length === 32) return asBase64;
  } catch {
    // Ignore and fall through to UTF-8 check.
  }

  const asUtf8 = Buffer.from(trimmed, 'utf8');
  if (asUtf8.length === 32) return asUtf8;

  throw new Error('WEBHOOK_ENCRYPTION_KEY must resolve to exactly 32 bytes');
}

export function generateWebhookSigningSecret(): string {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(24).toString('hex')}`;
}

export function getWebhookSecretPreview(secret: string): string {
  if (secret.length <= 12) return secret;
  return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
}

export function encryptWebhookSecret(secret: string): string {
  const key = readEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(WEBHOOK_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptWebhookSecret(encryptedSecret: string): string {
  const key = readEncryptionKey();
  const [ivB64, authTagB64, payloadB64] = encryptedSecret.split('.');

  if (!ivB64 || !authTagB64 || !payloadB64) {
    throw new Error('Malformed encrypted webhook secret');
  }

  const decipher = createDecipheriv(
    WEBHOOK_ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadB64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}
