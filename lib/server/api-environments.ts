export type ApiEnvironment = 'test' | 'production';

export const API_ENVIRONMENTS: ApiEnvironment[] = ['test', 'production'];

export function normalizeApiEnvironment(value: unknown): ApiEnvironment {
  return API_ENVIRONMENTS.includes(value as ApiEnvironment) ? (value as ApiEnvironment) : 'test';
}

export function getApiKeyPrefix(environment: ApiEnvironment): string {
  return environment === 'production' ? 'sk_live_' : 'sk_test_';
}
