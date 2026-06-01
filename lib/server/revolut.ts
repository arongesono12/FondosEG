import { createSign, randomUUID } from 'crypto';

type RevolutPayoutMethod = 'revolut' | 'bank_account' | 'card';
type RevolutPayoutState =
  | 'created'
  | 'failed'
  | 'awaiting'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'processing'
  | 'processed';

export interface RevolutPayoutLink {
  id: string;
  state: RevolutPayoutState;
  created_at: string;
  updated_at: string;
  counterparty_name: string;
  request_id: string;
  account_id: string;
  amount: number;
  currency: string;
  reference: string;
  payout_methods: RevolutPayoutMethod[];
  save_counterparty: boolean;
  expiry_date?: string;
  url?: string;
}

interface CreateRevolutPayoutLinkInput {
  requestId: string;
  counterpartyName: string;
  amount: number;
  currency: string;
  reference: string;
}

interface RevolutTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export class RevolutConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevolutConfigError';
  }
}

export class RevolutApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'RevolutApiError';
    this.status = status;
    this.body = body;
  }
}

function getBaseUrl() {
  if (process.env.REVOLUT_API_BASE_URL) {
    return process.env.REVOLUT_API_BASE_URL.replace(/\/$/, '');
  }

  return process.env.REVOLUT_ENV === 'production'
    ? 'https://b2b.revolut.com'
    : 'https://sandbox-b2b.revolut.com';
}

function getPrivateKey() {
  const key = process.env.REVOLUT_PRIVATE_KEY;
  if (!key) return null;
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createClientAssertion() {
  const clientId = process.env.REVOLUT_CLIENT_ID;
  const issuer = process.env.REVOLUT_REDIRECT_DOMAIN;
  const privateKey = getPrivateKey();

  if (!clientId || !issuer || !privateKey) {
    throw new RevolutConfigError(
      'Configura REVOLUT_CLIENT_ID, REVOLUT_REDIRECT_DOMAIN y REVOLUT_PRIVATE_KEY para refrescar el token de Revolut.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: issuer,
      sub: clientId,
      aud: 'https://revolut.com',
      exp: now + 300,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKey);

  return `${signingInput}.${base64Url(signature)}`;
}

async function refreshAccessToken() {
  const refreshToken = process.env.REVOLUT_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new RevolutConfigError('Configura REVOLUT_ACCESS_TOKEN o REVOLUT_REFRESH_TOKEN para llamar a Revolut.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: createClientAssertion(),
  });

  if (process.env.REVOLUT_CLIENT_ID) {
    body.set('client_id', process.env.REVOLUT_CLIENT_ID);
  }

  const response = await fetch(`${getBaseUrl()}/api/1.0/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await response.json().catch(() => null)) as RevolutTokenResponse | null;

  if (!response.ok || !data?.access_token) {
    throw new RevolutApiError(
      data?.error_description || data?.error || 'No se pudo refrescar el token de Revolut.',
      response.status,
      data
    );
  }

  return data.access_token;
}

async function getAccessToken() {
  if (process.env.REVOLUT_ACCESS_TOKEN) {
    return process.env.REVOLUT_ACCESS_TOKEN;
  }

  return refreshAccessToken();
}

function getConfiguredPayoutMethods(): RevolutPayoutMethod[] {
  const configured = process.env.REVOLUT_PAYOUT_METHODS || 'revolut,bank_account';
  const allowed = new Set<RevolutPayoutMethod>(['revolut', 'bank_account', 'card']);
  const methods = configured
    .split(',')
    .map((method) => method.trim())
    .filter((method): method is RevolutPayoutMethod => allowed.has(method as RevolutPayoutMethod));

  return methods.length > 0 ? methods : ['revolut', 'bank_account'];
}

function getExpiryPeriod() {
  return process.env.REVOLUT_PAYOUT_EXPIRY_PERIOD || 'P7D';
}

export function createRevolutRequestId(prefix = 'fondoseg') {
  return `${prefix}-${randomUUID()}`.slice(0, 40);
}

export async function createRevolutPayoutLink(input: CreateRevolutPayoutLinkInput) {
  const accountId = process.env.REVOLUT_ACCOUNT_ID;
  if (!accountId) {
    throw new RevolutConfigError('Configura REVOLUT_ACCOUNT_ID para crear payout links de Revolut.');
  }

  const response = await fetch(`${getBaseUrl()}/api/1.0/payout-links`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      request_id: input.requestId,
      account_id: accountId,
      counterparty_name: input.counterpartyName,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      reference: input.reference.slice(0, 100),
      payout_methods: getConfiguredPayoutMethods(),
      expiry_period: getExpiryPeriod(),
      save_counterparty: false,
    }),
  });
  const data = (await response.json().catch(() => null)) as RevolutPayoutLink | { message?: string } | null;

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : 'Revolut rechazó la creación del payout link.';
    throw new RevolutApiError(message, response.status, data);
  }

  return data as RevolutPayoutLink;
}
