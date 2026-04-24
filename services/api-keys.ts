import type {
  ApiKeyRecord,
  ApiUsageResponse,
  CreateApiKeyData,
  CreatedApiKeyResponse,
  RotateApiKeyResponse,
} from '@/types';
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

export async function getApiKeyUsage(apiKeyId?: string): Promise<ApiUsageResponse> {
  const params = new URLSearchParams({ limit: '20' });
  if (apiKeyId) params.set('api_key_id', apiKeyId);
  return fetchJSON<ApiUsageResponse>(`/api/api-keys/usage?${params.toString()}`);
}

export async function rotateApiKey(id: string): Promise<RotateApiKeyResponse> {
  return fetchJSON<RotateApiKeyResponse>(`/api/api-keys/${encodeURIComponent(id)}/rotate`, {
    method: 'POST',
  });
}
