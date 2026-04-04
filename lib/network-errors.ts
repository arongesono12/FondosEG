function hasErrorCode(error: unknown, expectedCode: string): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('code' in error && (error as { code?: unknown }).code === expectedCode) {
    return true;
  }

  if ('cause' in error) {
    return hasErrorCode((error as { cause?: unknown }).cause, expectedCode);
  }

  return false;
}

function hasErrorMessage(error: unknown, patterns: string[]): boolean {
  if (!error || typeof error !== 'object') return false;

  const msg = 'message' in error ? (error as { message?: unknown }).message : undefined;
  if (typeof msg === 'string') {
    const messageStr = msg.toLowerCase();
    if (patterns.some((pattern) => messageStr.includes(pattern.toLowerCase()))) {
      return true;
    }
  }

  if ('cause' in error) {
    return hasErrorMessage((error as { cause?: unknown }).cause, patterns);
  }

  return false;
}

const TRANSIENT_NETWORK_PATTERNS = [
  'fetch failed',
  'connect timeout',
  'service unavailable',
  'socket error',
  'socketerror',
  'other side closed',
  'connection closed',
];

const TRANSIENT_NETWORK_CODES = ['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'];

export function isTransientNetworkError(error: unknown): boolean {
  return (
    TRANSIENT_NETWORK_CODES.some((code) => hasErrorCode(error, code)) ||
    hasErrorMessage(error, TRANSIENT_NETWORK_PATTERNS)
  );
}

export function isTransientNetworkMessage(message: string): boolean {
  return TRANSIENT_NETWORK_PATTERNS.some((pattern) => message.toLowerCase().includes(pattern));
}
