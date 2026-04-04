import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireRole } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import { isTransferCompleted } from '@/lib/financial';
import type { DailyTransferStats } from '@/types';

type TransferRow = {
  agent_id?: string | null;
  amount: number | string | null;
  created_at: string;
  status?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, ['admin', 'gestor']);

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365);

    const adminClient = createAdminClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    let query = adminClient
      .from('transfers')
      .select('agent_id, created_at, amount, status')
      .gte('created_at', startDate.toISOString());

    if (profile.role === 'gestor') {
      query = query.eq('agent_id', profile.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const dailyMap = new Map<string, { count: number; amount: number; agents: Set<string> }>();

    ((data ?? []) as TransferRow[])
      .filter((transfer) => isTransferCompleted(transfer.status))
      .forEach((transfer) => {
        const date = new Date(transfer.created_at).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || { count: 0, amount: 0, agents: new Set<string>() };
        existing.count += 1;
        existing.amount += Number(transfer.amount ?? 0);
        if (transfer.agent_id) {
          existing.agents.add(transfer.agent_id);
        }
        dailyMap.set(date, existing);
      });

    const result: DailyTransferStats[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const currentDay = new Date();
      currentDay.setDate(currentDay.getDate() - i);
      const dateStr = currentDay.toISOString().split('T')[0];
      const dayData = dailyMap.get(dateStr);

      result.push({
        date: dateStr,
        transfer_count: dayData?.count || 0,
        total_amount: dayData?.amount || 0,
        agent_count: profile.role === 'gestor' ? (dayData?.count ? 1 : 0) : dayData?.agents.size || 0,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/daily-transfer-stats');
  }
}
