import type { DashboardStats, DailyTransferStats, AgentTransferStats, Transfer } from '@/types';

async function fetchJSON<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed: ${res.status}`);
  }
  return data as T;
}

export async function getAgentDashboardStats(_agentId: string): Promise<DashboardStats> {
  return fetchJSON<DashboardStats>('/api/dashboard/stats');
}

export async function getAdminDashboardStats(): Promise<DashboardStats> {
  return fetchJSON<DashboardStats>('/api/dashboard/stats');
}

export async function getDailyTransferStats(days: number = 30): Promise<DailyTransferStats[]> {
  return fetchJSON<DailyTransferStats[]>(`/api/dashboard/daily-transfer-stats?days=${encodeURIComponent(String(days))}`);
}

export async function getAgentTransferStats(): Promise<AgentTransferStats[]> {
  return fetchJSON<AgentTransferStats[]>('/api/dashboard/agent-transfer-stats');
}

export async function getRecentTransfers(limit: number = 10): Promise<Transfer[]> {
  return fetchJSON<Transfer[]>(`/api/dashboard/recent-transfers?limit=${encodeURIComponent(String(limit))}`);
}

export async function getAgentsCommissionStats(): Promise<any> {
  return fetchJSON<any>('/api/dashboard/agents-commission');
}

