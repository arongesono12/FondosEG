import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import {
  estimateFloatUtilization,
  estimateLiquidityCoverageDays,
  estimateProjectedTopups24h,
  getAvailableClientBalance,
} from '@/lib/financial';
import type { DashboardStats } from '@/types';
import { isAdminRole } from '@/lib/roles';

/** Umbral operativo de float por gestor (XAF). */
const LOW_BALANCE_THRESHOLD = 25000;

type Numeric = number | string | null | undefined;

type PeriodTotals = {
  completed_count: Numeric;
  completed_amount: Numeric;
  pending_count: Numeric;
  cancelled_count: Numeric;
  today_count: Numeric;
  today_completed_amount: Numeric;
  week_completed_amount: Numeric;
  thirty_days_completed_amount: Numeric;
};

type OperatorTotals = PeriodTotals & {
  pending_amount: Numeric;
  pickup_ready_count: Numeric;
  pickup_ready_amount: Numeric;
  commissionable_count: Numeric;
  commission_total: Numeric;
  commission_today: Numeric;
  commission_month: Numeric;
  commission_year: Numeric;
  balances_by_currency: Record<string, Numeric> | null;
  agents_below_threshold: Numeric;
  total_clients: Numeric;
  active_agents: Numeric;
};

type ClientBalanceRow = {
  balance: number | string | null;
  reserved_balance?: number | string | null;
  currency: string | null;
};

/** PostgREST serializa NUMERIC como número o como cadena según su tamaño. */
function num(value: Numeric): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumberRecord(values: Record<string, Numeric> | null | undefined): Record<string, number> {
  return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, num(value)]));
}

function settlementRate(completed: number, pending: number, cancelled: number): number {
  const total = completed + pending + cancelled;
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

export async function GET() {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    // Los agregados se calculan en PostgreSQL (supabase/migrations/
    // 20260925_dashboard_sql_aggregates.sql): descargar las filas y sumarlas
    // aquí truncaba los totales al límite de filas de PostgREST.
    const periods = {
      p_today: today.toISOString(),
      p_week_start: sevenDaysAgo.toISOString(),
      p_thirty_days_start: thirtyDaysAgo.toISOString(),
    };

    if (isAdminRole(profile.role) || profile.role === 'gestor') {
      const isAdmin = isAdminRole(profile.role);

      const { data, error } = await adminClient.rpc('dashboard_operator_stats', {
        p_agent_id: isAdmin ? null : profile.id,
        ...periods,
        p_month_start: monthStart.toISOString(),
        p_year_start: yearStart.toISOString(),
        p_low_balance_threshold: LOW_BALANCE_THRESHOLD,
      });
      if (error) throw error;

      const totals = (data ?? {}) as OperatorTotals;
      const balancesByCurrency = toNumberRecord(totals.balances_by_currency);
      const availableBalance = Object.values(balancesByCurrency).reduce((sum, amount) => sum + amount, 0);

      const totalSent = num(totals.completed_amount);
      const monthlyVolume = num(totals.thirty_days_completed_amount);
      const pendingExposure = num(totals.pending_amount);
      const totalCommission = num(totals.commission_total);
      const completedTransfers = num(totals.completed_count);
      const pendingTransfers = num(totals.pending_count);
      const cancelledTransfers = num(totals.cancelled_count);
      const commissionableTransfers = num(totals.commissionable_count);
      const averageDailyOutflow = monthlyVolume > 0 ? monthlyVolume / 30 : 0;

      const stats: DashboardStats = {
        totalBalance: availableBalance + pendingExposure,
        availableBalance,
        reservedBalance: pendingExposure,
        pendingExposure,
        todayTransfers: num(totals.today_count),
        totalSent,
        totalClients: num(totals.total_clients),
        balancesByCurrency,
        totalCommission,
        todayCommission: num(totals.commission_today),
        monthlyCommission: num(totals.commission_month),
        yearlyCommission: num(totals.commission_year),
        commissionPerTransfer: commissionableTransfers > 0 ? totalCommission / commissionableTransfers : 0,
        averageTicket: completedTransfers > 0 ? totalSent / completedTransfers : 0,
        todayVolume: num(totals.today_completed_amount),
        weeklyVolume: num(totals.week_completed_amount),
        monthlyVolume,
        settlementRate: settlementRate(completedTransfers, pendingTransfers, cancelledTransfers),
        activeAgents: isAdmin ? num(totals.active_agents) : completedTransfers > 0 ? 1 : 0,
        agentsBelowThreshold: num(totals.agents_below_threshold),
        projectedTopups24h: estimateProjectedTopups24h(averageDailyOutflow, availableBalance),
        liquidityCoverageDays: estimateLiquidityCoverageDays(availableBalance, averageDailyOutflow),
        floatUtilization: estimateFloatUtilization(pendingExposure, availableBalance),
        pickupReadyTransfers: num(totals.pickup_ready_count),
        pickupReadyAmount: num(totals.pickup_ready_amount),
        completedTransfers,
        pendingTransfers,
        cancelledTransfers,
      };

      return NextResponse.json(stats);
    }

    const [
      { data: balances, error: balancesError },
      { data, error: totalsError },
    ] = await Promise.all([
      adminClient.from('client_balances').select('balance, reserved_balance, currency').eq('client_id', profile.id),
      adminClient.rpc('dashboard_client_stats', { p_client_id: profile.id, ...periods }),
    ]);

    if (balancesError) throw balancesError;
    if (totalsError) throw totalsError;

    const safeBalances = (balances ?? []) as ClientBalanceRow[];
    const totals = (data ?? {}) as PeriodTotals;

    const balancesByCurrency = safeBalances.reduce<Record<string, number>>((acc, row) => {
      const currency = row.currency || 'XAF';
      acc[currency] = (acc[currency] ?? 0) + getAvailableClientBalance(Number(row.balance ?? 0), Number(row.reserved_balance ?? 0));
      return acc;
    }, {});

    const availableBalance = safeBalances.reduce(
      (sum, row) => sum + getAvailableClientBalance(Number(row.balance ?? 0), Number(row.reserved_balance ?? 0)),
      0
    );
    const reservedBalance = safeBalances.reduce((sum, row) => sum + Number(row.reserved_balance ?? 0), 0);

    const totalSent = num(totals.completed_amount);
    const completedTransfers = num(totals.completed_count);
    const pendingTransfers = num(totals.pending_count);
    const cancelledTransfers = num(totals.cancelled_count);

    const stats: DashboardStats = {
      totalBalance: availableBalance + reservedBalance,
      availableBalance,
      reservedBalance,
      pendingExposure: reservedBalance,
      todayTransfers: num(totals.today_count),
      totalSent,
      totalClients: 0,
      balancesByCurrency,
      totalCommission: 0,
      todayCommission: 0,
      monthlyCommission: 0,
      yearlyCommission: 0,
      commissionPerTransfer: 0,
      averageTicket: completedTransfers > 0 ? totalSent / completedTransfers : 0,
      todayVolume: num(totals.today_completed_amount),
      weeklyVolume: num(totals.week_completed_amount),
      monthlyVolume: num(totals.thirty_days_completed_amount),
      settlementRate: settlementRate(completedTransfers, pendingTransfers, cancelledTransfers),
      floatUtilization: estimateFloatUtilization(reservedBalance, availableBalance),
      pickupReadyTransfers: 0,
      pickupReadyAmount: 0,
      completedTransfers,
      pendingTransfers,
      cancelledTransfers,
    };

    return NextResponse.json(stats);
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/stats');
  }
}
