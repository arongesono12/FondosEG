export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `fondoseg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isProbablyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /network|fetch|timeout|timed out|socket|econnreset|etimedout/i.test(error.message);
}
