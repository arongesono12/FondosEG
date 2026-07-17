import type { Transfer, TransferFormData } from '@/types';
import { fetchJSON } from '@/services/http';

export function getTransfers(limit = 50): Promise<Transfer[]> {
  return fetchJSON<Transfer[]>(`/api/transfers?limit=${encodeURIComponent(String(limit))}`);
}

export function getAllTransfers(limit = 50): Promise<Transfer[]> {
  return getTransfers(limit);
}

export function createTransfer(data: TransferFormData) {
  return fetchJSON<{ success: boolean; transfer?: Transfer; error?: string }>('/api/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function correctTransfer(transferId: string, data: Partial<TransferFormData>) {
  return fetchJSON<{ success: boolean; transfer?: Transfer; error?: string }>(
    `/api/transfers/${encodeURIComponent(transferId)}/correct`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
  );
}

export function createRevolutPayoutForTransfer(transferId: string) {
  return fetchJSON<{ success: boolean; transfer?: Transfer; error?: string }>(
    `/api/transfers/${encodeURIComponent(transferId)}/revolut-payout`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } }
  );
}

export function searchTransfers(query: string): Promise<Transfer[]> {
  return fetchJSON<Transfer[]>(`/api/transfers/search?q=${encodeURIComponent(query)}&limit=10`);
}

