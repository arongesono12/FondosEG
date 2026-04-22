import { isTransientNetworkMessage } from '@/lib/network-errors';

function getErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return;
  if (!('error' in data)) return;
  const error = (data as { error?: unknown }).error;
  return typeof error === 'string' ? error : undefined;
}

export class HttpError extends Error {
  status: number;
  data: unknown;
  url: string;
  method: string;

  constructor(message: string, status: number, data: unknown, url: string, method: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
    this.url = url;
    this.method = method;
  }
}

const RETRY_DELAYS_MS = [400, 1000];

function shouldRetryRequest(method: string, status?: number): boolean {
  return method === 'GET' && status === 503;
}

function shouldRetryFetchError(method: string, error: unknown): boolean {
  return (
    method === 'GET' &&
    error instanceof Error &&
    isTransientNetworkMessage(error.message)
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJSON<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input.toString();

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(input, { credentials: 'include', ...init });
      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        if (attempt < RETRY_DELAYS_MS.length && shouldRetryRequest(method, res.status)) {
          await wait(RETRY_DELAYS_MS[attempt]);
          continue;
        }

        const fallbackMessage =
          res.status === 401
            ? 'No autorizado'
            : res.status === 503
              ? 'Servicio no disponible'
              : `La solicitud no pudo completarse (${res.status})`;
        const message = getErrorMessage(data) || fallbackMessage;
        if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
        throw new HttpError(message, res.status, data, url, method);
      }

      return data as T;
    } catch (error) {
      if (attempt < RETRY_DELAYS_MS.length && shouldRetryFetchError(method, error)) {
        await wait(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Unexpected fetch failure for ${method} ${url}`);
}
