import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireRole } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import type { AgentTransferStats } from '@/types';

type AgentRow = {
  agent_id: string;
  agent_name: string | null;
  transfer_count: number | string | null;
  total_sent: number | string | null;
  last_transfer: string;
};

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    // Agrupado y ordenado en PostgreSQL:
    // supabase/migrations/20260925_dashboard_sql_aggregates.sql.
    const { data, error } = await createAdminClient().rpc('dashboard_agent_transfer_stats', {});
    if (error) throw error;

    const result: AgentTransferStats[] = ((data ?? []) as AgentRow[]).map((row) => ({
      agent_id: row.agent_id,
      agent_name: row.agent_name || 'Unknown',
      transfer_count: Number(row.transfer_count ?? 0),
      total_sent: Number(row.total_sent ?? 0),
      last_transfer: row.last_transfer,
    }));

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/agent-transfer-stats');
  }
}
