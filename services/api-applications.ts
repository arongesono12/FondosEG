import type { ApiApplication, CreateApiApplicationData, UpdateApiApplicationData } from '@/types';
import { fetchJSON } from './http';

const applicationUrl = (id: string) => `/api/applications/${encodeURIComponent(id)}`;

export async function getApiApplications(): Promise<ApiApplication[]> {
  return fetchJSON<ApiApplication[]>('/api/applications');
}

export async function createApiApplication(
  payload: CreateApiApplicationData
): Promise<{ success: boolean; application: ApiApplication }> {
  return fetchJSON<{ success: boolean; application: ApiApplication }>('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateApiApplication(
  id: string,
  payload: UpdateApiApplicationData
): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(applicationUrl(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** PNG, JPG o WebP de hasta 512 KB. */
export async function uploadApiApplicationIcon(
  id: string,
  icon: Blob
): Promise<{ success: boolean; icon_url: string }> {
  const body = new FormData();
  body.append('icon', icon, 'icon.png');
  return fetchJSON<{ success: boolean; icon_url: string }>(`${applicationUrl(id)}/icon`, { method: 'POST', body });
}

export async function removeApiApplicationIcon(id: string): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`${applicationUrl(id)}/icon`, { method: 'DELETE' });
}

/** Archiva la aplicación: revoca sus credenciales y desactiva sus webhooks. */
export async function archiveApiApplication(id: string): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(applicationUrl(id), { method: 'DELETE' });
}
