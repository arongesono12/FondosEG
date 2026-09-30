import type { Transfer, TransferFormData } from '@/types';
import { fetchJSON } from '@/services/http';

export function getTransfers(limit = 50): Promise<Transfer[]> {
  return fetchJSON<Transfer[]>(`/api/transfers?limit=${encodeURIComponent(String(limit))}`);
}

export function getAllTransfers(limit = 50): Promise<Transfer[]> {
  return getTransfers(limit);
}

export type TransferHistoryStatus = 'all' | 'completed' | 'created' | 'cancelled';

export interface TransferHistoryQuery {
  q?: string;
  status?: TransferHistoryStatus;
  from?: string;
  to?: string;
  cursor?: string | null;
  limit?: number;
}

export interface TransferHistoryPage {
  items: Transfer[];
  nextCursor: string | null;
}

/** Historial paginado: búsqueda, estado y fechas se aplican en el servidor sobre todo el historial. */
export function getTransferHistory(query: TransferHistoryQuery, init?: RequestInit): Promise<TransferHistoryPage> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.cursor) params.set('cursor', query.cursor);
  params.set('limit', String(query.limit ?? 50));
  return fetchJSON<TransferHistoryPage>(`/api/transfers/history?${params.toString()}`, init);
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

