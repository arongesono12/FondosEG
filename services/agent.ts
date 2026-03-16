import type { AgentBalance, BalanceTransaction, AgentWithBalance } from '@/types';
import type { RegisterFormData } from '@/types';

async function fetchJSON<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed: ${res.status}`);
  }
  return data as T;
}

export async function getAgents(): Promise<AgentWithBalance[]> {
  return fetchJSON<AgentWithBalance[]>('/api/agents');
}

export async function getAgentBalance(agentId: string): Promise<AgentBalance | null> {
  return fetchJSON<AgentBalance | null>(`/api/agent-balance?agentId=${encodeURIComponent(agentId)}`);
}

export async function getAgentTransactions(agentId: string, limit: number = 50): Promise<BalanceTransaction[]> {
  return fetchJSON<BalanceTransaction[]>(
    `/api/agent-transactions?agentId=${encodeURIComponent(agentId)}&limit=${encodeURIComponent(String(limit))}`
  );
}

export async function toggleAgentStatus(agentId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>(`/api/agents/${encodeURIComponent(agentId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function topUpAgentBalance(
  agentId: string,
  amount: number,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>(`/api/agents/${encodeURIComponent(agentId)}/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, description }),
  });
}

export async function resetAgentBalance(
  agentId: string,
  _adminId: string,
  newBalance: number = 0
): Promise<{ success: boolean; error?: string }> {
  return fetchJSON<{ success: boolean; error?: string }>(`/api/agents/${encodeURIComponent(agentId)}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newBalance }),
  });
}

export async function createAgent(data: RegisterFormData): Promise<{ success: boolean; user?: any; error?: string }> {
  return fetchJSON<{ success: boolean; user?: any; error?: string }>('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
