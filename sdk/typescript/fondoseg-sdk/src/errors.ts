import type { FondosEGApiFailure, FondosEGErrorPayload } from './types';

export class FondosEGError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FondosEGError';
  }
}

export class FondosEGApiError extends FondosEGError {
  status: number;
  code?: string;
  requestId?: string;
  details?: unknown;
  data: unknown;

  constructor(input: {
    message: string;
    status: number;
    code?: string;
    requestId?: string;
    details?: unknown;
    data: unknown;
  }) {
    super(input.message);
    this.name = 'FondosEGApiError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.details = input.details;
    this.data = input.data;
  }
}

export class FondosEGNetworkError extends FondosEGError {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'FondosEGNetworkError';
    this.cause = cause;
  }
}

export function isFondosEGApiFailure(value: unknown): value is FondosEGApiFailure {
  if (!value || typeof value !== 'object') return false;
  return (
    'success' in value &&
    (value as { success?: unknown }).success === false &&
    'error' in value
  );
}

export function toApiErrorPayload(value: unknown): FondosEGErrorPayload | undefined {
  if (!isFondosEGApiFailure(value)) return undefined;
  const error = value.error;
  if (!error || typeof error !== 'object') return undefined;
  if (typeof error.code !== 'string' || typeof error.message !== 'string') return undefined;
  return error;
}
