import type { ApiKeyRecord, CreateApiKeyData, CreatedApiKeyResponse } from '@/types';
import { fetchJSON } from './http';

export async function getApiKeys(): Promise<ApiKeyRecord[]> {
  return fetchJSON<ApiKeyRecord[]>('/api/api-keys');
}

export async function createApiKey(payload: CreateApiKeyData): Promise<CreatedApiKeyResponse> {
  return fetchJSON<CreatedApiKeyResponse>('/api/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function revokeApiKey(id: string): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/api/api-keys?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
