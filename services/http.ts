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

export async function fetchJSON<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input.toString();
  const res = await fetch(input, { credentials: 'include', ...init });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const fallbackMessage =
      res.status === 401
        ? 'Unauthorized'
        : res.status === 503
          ? 'Service unavailable'
          : `Request failed: ${res.status}`;
    const message = getErrorMessage(data) || fallbackMessage;
    if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new HttpError(`${method} ${url}: ${message}`, res.status, data, url, method);
  }
  return data as T;
}
