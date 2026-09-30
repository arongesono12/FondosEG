import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireRole } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import type { DailyTransferStats } from '@/types';

type DailyRow = {
  date: string;
  transfer_count: number | string | null;
  total_amount: number | string | null;
  agent_count: number | string | null;
};

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, ['admin', 'gestor']);

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365);

    // La serie (días naturales en UTC, sin huecos) se agrega en PostgreSQL:
    // supabase/migrations/20260925_dashboard_sql_aggregates.sql.
    const { data, error } = await createAdminClient().rpc('dashboard_daily_transfer_stats', {
      p_agent_id: profile.role === 'gestor' ? profile.id : null,
      p_days: days,
    });
    if (error) throw error;

    const result: DailyTransferStats[] = ((data ?? []) as DailyRow[]).map((row) => ({
      date: row.date,
      transfer_count: Number(row.transfer_count ?? 0),
      total_amount: Number(row.total_amount ?? 0),
      agent_count: Number(row.agent_count ?? 0),
    }));

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/daily-transfer-stats');
  }
}
