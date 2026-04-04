import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireRole } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';

type BalanceTransactionRow = {
  type: string | null;
  amount: number | string | null;
  created_at: string;
};

function getPeriodKey(dateIso: string): string {
  const date = new Date(dateIso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getPeriodStart(months: number): Date {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  return start;
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const { searchParams } = new URL(request.url);
    const months = Math.min(Math.max(Number(searchParams.get('months') || 6), 1), 12);
    const startDate = getPeriodStart(months);

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('balance_transactions')
      .select('type, amount, created_at')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const buckets = new Map<string, {
      period: string;
      topups: number;
      transfersOutflow: number;
      refunds: number;
      resets: number;
      netFlow: number;
      transactionCount: number;
    }>();

    (data || []).forEach((row: BalanceTransactionRow) => {
      const period = getPeriodKey(row.created_at);
      const amount = Number(row.amount ?? 0);
      const type = row.type ?? 'unknown';

      const bucket = buckets.get(period) ?? {
        period,
        topups: 0,
        transfersOutflow: 0,
        refunds: 0,
        resets: 0,
        netFlow: 0,
        transactionCount: 0,
      };

      if (type === 'topup') bucket.topups += amount;
      if (type === 'transfer') bucket.transfersOutflow += Math.abs(amount);
      if (type === 'refund') bucket.refunds += amount;
      if (type === 'reset') bucket.resets += amount;

      bucket.netFlow += amount;
      bucket.transactionCount += 1;
      buckets.set(period, bucket);
    });

    const periods = Array.from(buckets.values()).sort((a, b) => b.period.localeCompare(a.period));
    const totalNetFlow = periods.reduce((sum, period) => sum + period.netFlow, 0);

    return NextResponse.json({ periods, totalNetFlow });
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/reconciliation');
  }
}
