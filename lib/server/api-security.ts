import { createHash, randomBytes, timingSafeEqual } from 'crypto';

function toBuffer(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

export function generateApiKey(): string {
  return `sk_${randomBytes(24).toString('hex')}`;
}

export function generateApiSecret(): string {
  return randomBytes(32).toString('hex');
}

export function hashApiSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function getApiSecretPreview(secret: string): string {
  if (secret.length <= 10) return secret;
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

export function verifyApiSecret(secret: string, expectedHashOrSecret: string, isLegacyPlaintext: boolean = false): boolean {
  const left = toBuffer(isLegacyPlaintext ? secret : hashApiSecret(secret));
  const right = toBuffer(expectedHashOrSecret);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function hashRequestPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}

