import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireRole } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import { calculateCommission } from '@/lib/tariffs';
import { estimateOperatingCost } from '@/lib/financial';

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const adminClient = createAdminClient();
    const { data: transfers, error } = await adminClient
      .from('transfers')
      .select('agent_id, amount, commission_amount, created_at, users!transfers_agent_id_fkey(name)')
      .neq('status', 'cancelled');

    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const agentMap = new Map<
      string,
      {
        agent_id: string;
        agent_name: string;
        total_commission: number;
        today_commission: number;
        month_commission: number;
        year_commission: number;
        transfer_count: number;
      }
    >();

    interface TComm { agent_id: string; amount: number; commission_amount?: number; created_at: string; users?: { name: string } }
    (transfers as unknown as TComm[] || []).forEach((transfer) => {
      const agentId = transfer.agent_id;
      const storedCommission = Number(transfer.commission_amount ?? 0);
      const commission = storedCommission > 0 ? storedCommission : calculateCommission(Number(transfer.amount));
      const isToday = new Date(transfer.created_at) >= today;
      const isCurrentMonth = new Date(transfer.created_at) >= monthStart;
      const isCurrentYear = new Date(transfer.created_at) >= yearStart;
      const agentName = transfer?.users?.name || 'Unknown';

      const existing = agentMap.get(agentId);
      if (existing) {
        existing.total_commission += commission;
        existing.transfer_count += 1;
        if (isToday) existing.today_commission += commission;
        if (isCurrentMonth) existing.month_commission += commission;
        if (isCurrentYear) existing.year_commission += commission;
      } else {
        agentMap.set(agentId, {
          agent_id: agentId,
          agent_name: agentName,
          total_commission: commission,
          today_commission: isToday ? commission : 0,
          month_commission: isCurrentMonth ? commission : 0,
          year_commission: isCurrentYear ? commission : 0,
          transfer_count: 1,
        });
      }
    });

    const agents = Array.from(agentMap.values()).map((agent) => {
      const estimatedCost = estimateOperatingCost(agent.transfer_count);
      const netProfit = agent.total_commission - estimatedCost;
      const netMargin = agent.total_commission > 0 ? Math.round((netProfit / agent.total_commission) * 100) : 0;
      return {
        ...agent,
        estimated_cost: estimatedCost,
        net_profit: netProfit,
        net_margin: netMargin,
      };
    }).sort((a, b) => b.net_profit - a.net_profit);

    const totalCommission = agents.reduce((sum, a) => sum + a.total_commission, 0);
    const todayCommission = agents.reduce((sum, a) => sum + a.today_commission, 0);
    const monthCommission = agents.reduce((sum, a) => sum + a.month_commission, 0);
    const yearCommission = agents.reduce((sum, a) => sum + a.year_commission, 0);
    const totalEstimatedCost = agents.reduce((sum, a) => sum + a.estimated_cost, 0);
    const totalNetProfit = agents.reduce((sum, a) => sum + a.net_profit, 0);
    const averageNetMargin = totalCommission > 0 ? Math.round((totalNetProfit / totalCommission) * 100) : 0;

    return NextResponse.json({ agents, totalCommission, todayCommission, monthCommission, yearCommission, totalEstimatedCost, totalNetProfit, averageNetMargin });
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/agents-commission');
  }
}

