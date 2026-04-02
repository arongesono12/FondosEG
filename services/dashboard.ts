import type {
  DashboardStats,
  DailyTransferStats,
  AgentTransferStats,
  Transfer,
  AgentsCommissionStats,
} from '@/types';
import { fetchJSON } from '@/services/http';

export async function getDashboardStats(): Promise<DashboardStats> {
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

export async function getAgentsCommissionStats(): Promise<AgentsCommissionStats> {
  return fetchJSON<AgentsCommissionStats>('/api/dashboard/agents-commission');
}
