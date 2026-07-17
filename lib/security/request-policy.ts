export interface RequestPolicyInput {
  requestHost: string;
  origin: string | null;
  fetchSite: string | null;
}

export function isAllowedSameOriginMutation(input: RequestPolicyInput): boolean {
  if (input.fetchSite === 'cross-site') return false;
  if (!input.origin) {
    return input.fetchSite === 'same-origin' || input.fetchSite === 'same-site';
  }

  try {
    return new URL(input.origin).host === input.requestHost;
  } catch {
    return false;
  }
}

export function exceedsByteLimit(value: string, maxBytes: number): boolean {
  return Buffer.byteLength(value, 'utf8') > maxBytes;
}

