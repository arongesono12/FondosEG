import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { calculateCommission } from '@/lib/tariffs';

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const adminClient = createAdminClient();
    const { data: transfers, error } = await adminClient
      .from('transfers')
      .select('agent_id, amount, created_at, users!transfers_agent_id_fkey(name)')
      .eq('status', 'completed');

    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agentMap = new Map<
      string,
      { agent_id: string; agent_name: string; total_commission: number; today_commission: number; transfer_count: number }
    >();

    (transfers || []).forEach((transfer: any) => {
      const agentId = transfer.agent_id;
      const commission = calculateCommission(Number(transfer.amount));
      const isToday = new Date(transfer.created_at) >= today;
      const agentName = transfer?.users?.name || 'Unknown';

      const existing = agentMap.get(agentId);
      if (existing) {
        existing.total_commission += commission;
        existing.transfer_count += 1;
        if (isToday) existing.today_commission += commission;
      } else {
        agentMap.set(agentId, {
          agent_id: agentId,
          agent_name: agentName,
          total_commission: commission,
          today_commission: isToday ? commission : 0,
          transfer_count: 1,
        });
      }
    });

    const agents = Array.from(agentMap.values()).sort((a, b) => b.total_commission - a.total_commission);
    const totalCommission = agents.reduce((sum, a) => sum + a.total_commission, 0);
    const todayCommission = agents.reduce((sum, a) => sum + a.today_commission, 0);

    return NextResponse.json({ agents, totalCommission, todayCommission });
  } catch (err) {
    console.error('[GET /api/dashboard/agents-commission]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

