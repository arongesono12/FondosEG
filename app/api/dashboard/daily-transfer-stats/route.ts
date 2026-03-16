import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import type { DailyTransferStats } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365);

    const adminClient = createAdminClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const { data, error } = await adminClient
      .from('transfers')
      .select('created_at, amount')
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const dailyMap = new Map<string, { count: number; amount: number }>();
    (data || []).forEach((transfer: any) => {
      const date = new Date(transfer.created_at).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += Number(transfer.amount);
      dailyMap.set(date, existing);
    });

    const result: DailyTransferStats[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayData = dailyMap.get(dateStr);
      result.push({
        date: dateStr,
        transfer_count: dayData?.count || 0,
        total_amount: dayData?.amount || 0,
        agent_count: 0,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/dashboard/daily-transfer-stats]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

