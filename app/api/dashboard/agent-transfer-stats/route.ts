import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireRole } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import type { AgentTransferStats } from '@/types';

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('transfers')
      .select('agent_id, amount, created_at, users!transfers_agent_id_fkey(name)')
      .in('status', ['completed', 'paid_out']);

    if (error) throw error;

    const agentMap = new Map<string, AgentTransferStats>();
    (data || []).forEach((transfer: any) => {
      const existing = agentMap.get(transfer.agent_id);
      const agentName = transfer?.users?.name || 'Unknown';
      if (existing) {
        existing.transfer_count += 1;
        existing.total_sent += Number(transfer.amount);
        if (new Date(transfer.created_at) > new Date(existing.last_transfer)) {
          existing.last_transfer = transfer.created_at;
        }
      } else {
        agentMap.set(transfer.agent_id, {
          agent_id: transfer.agent_id,
          agent_name: agentName,
          transfer_count: 1,
          total_sent: Number(transfer.amount),
          last_transfer: transfer.created_at,
        });
      }
    });

    const result = Array.from(agentMap.values()).sort((a, b) => b.total_sent - a.total_sent);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/agent-transfer-stats');
  }
}
