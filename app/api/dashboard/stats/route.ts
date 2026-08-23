import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import {
  calculateCommission,
  estimateFloatUtilization,
  estimateLiquidityCoverageDays,
  estimateProjectedTopups24h,
  getAvailableClientBalance,
  isTransferCompleted,
  isTransferPending,
  mapWalletTransferStatus,
  normalizeTransferStatus,
} from '@/lib/financial';
import type { DashboardStats } from '@/types';
import { isAdminRole } from '@/lib/roles';

type TransferRow = {
  agent_id?: string | null;
  amount: number | string | null;
  commission_amount?: number | string | null;
  created_at: string;
  status: string | null;
};

type BalanceRow = {
  balance: number | string | null;
  currency: string | null;
};

function sumAmounts(rows: Array<{ amount: number | string | null }>): number {
  return rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

function groupBalancesByCurrency(rows: BalanceRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const currency = row.currency || 'XAF';
    acc[currency] = (acc[currency] ?? 0) + Number(row.balance ?? 0);
    return acc;
  }, {});
}

function isSameOrAfter(dateIso: string, threshold: Date): boolean {
  return new Date(dateIso) >= threshold;
}

function getCommissionAmount(transfer: TransferRow): number {
  const stored = Number(transfer.commission_amount ?? NaN);
  if (Number.isFinite(stored) && stored > 0) {
    return stored;
  }
  return calculateCommission(Number(transfer.amount ?? 0));
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

    if (isAdminRole(profile.role) || profile.role === 'gestor') {
      const isAdmin = isAdminRole(profile.role);

      const balancesQuery = adminClient
        .from('agent_balances')
        .select('balance, currency, agent_id');

      const transfersQuery = adminClient
        .from('transfers')
        .select('agent_id, amount, commission_amount, created_at, status');

      const clientsQuery = isAdmin
        ? adminClient.from('users').select('id').eq('role', 'cliente')
        : adminClient.from('transfers').select('sender_phone').eq('agent_id', profile.id);

      const activeAgentsQuery = isAdmin
        ? adminClient.from('users').select('id').eq('role', 'gestor').eq('is_active', true)
        : null;

      const scopedBalancesQuery = isAdmin ? balancesQuery : balancesQuery.eq('agent_id', profile.id);
      const scopedTransfersQuery = isAdmin ? transfersQuery : transfersQuery.eq('agent_id', profile.id);

      const [
        { data: balances, error: balancesError },
        { data: transfers, error: transfersError },
        { data: clients, error: clientsError },
        activeAgentsResult,
      ] = await Promise.all([
        scopedBalancesQuery,
        scopedTransfersQuery,
        clientsQuery,
        activeAgentsQuery,
      ]);

      if (balancesError) throw balancesError;
      if (transfersError) throw transfersError;
      if (clientsError) throw clientsError;
      if (activeAgentsResult?.error) throw activeAgentsResult.error;

      const safeBalances = (balances ?? []) as Array<BalanceRow & { agent_id?: string | null }>;
      const safeTransfers = (transfers ?? []) as TransferRow[];
      const safeClients = clients ?? [];

      const balancesByCurrency = groupBalancesByCurrency(safeBalances);
      const availableBalance = Object.values(balancesByCurrency).reduce((sum, amount) => sum + amount, 0);

      const completedTransfersRows = safeTransfers.filter((transfer) => isTransferCompleted(transfer.status));
      const pendingTransferRows = safeTransfers.filter((transfer) => isTransferPending(transfer.status));
      const cancelledTransferRows = safeTransfers.filter(
        (transfer) => normalizeTransferStatus(transfer.status) === 'cancelled'
      );
      const commissionableRows = safeTransfers.filter(
        (transfer) => normalizeTransferStatus(transfer.status) !== 'cancelled'
      );
      const pickupReadyRows = safeTransfers.filter(
        (transfer) => normalizeTransferStatus(transfer.status) === 'available_for_pickup'
      );

      const todayTransfersRows = safeTransfers.filter((transfer) => isSameOrAfter(transfer.created_at, today));
      const todayCompletedRows = completedTransfersRows.filter((transfer) => isSameOrAfter(transfer.created_at, today));
      const todayCommissionableRows = commissionableRows.filter((transfer) => isSameOrAfter(transfer.created_at, today));
      const monthCommissionableRows = commissionableRows.filter((transfer) => isSameOrAfter(transfer.created_at, monthStart));
      const yearCommissionableRows = commissionableRows.filter((transfer) => isSameOrAfter(transfer.created_at, yearStart));
      const recent7dCompletedRows = completedTransfersRows.filter((transfer) => isSameOrAfter(transfer.created_at, sevenDaysAgo));
      const recent30dCompletedRows = completedTransfersRows.filter((transfer) =>
        isSameOrAfter(transfer.created_at, thirtyDaysAgo)
      );

      const totalSent = sumAmounts(completedTransfersRows);
      const todayVolume = sumAmounts(todayCompletedRows);
      const weeklyVolume = sumAmounts(recent7dCompletedRows);
      const monthlyVolume = sumAmounts(recent30dCompletedRows);
      const pendingExposure = sumAmounts(pendingTransferRows);
      const pickupReadyAmount = sumAmounts(pickupReadyRows);

      const totalCommission = commissionableRows.reduce(
        (sum, transfer) => sum + getCommissionAmount(transfer),
        0
      );
      const todayCommission = todayCommissionableRows.reduce(
        (sum, transfer) => sum + getCommissionAmount(transfer),
        0
      );
      const monthlyCommission = monthCommissionableRows.reduce(
        (sum, transfer) => sum + getCommissionAmount(transfer),
        0
      );
      const yearlyCommission = yearCommissionableRows.reduce(
        (sum, transfer) => sum + getCommissionAmount(transfer),
        0
      );

      const completedTransfers = completedTransfersRows.length;
      const pendingTransfers = pendingTransferRows.length;
      const cancelledTransfers = cancelledTransferRows.length;
      const totalLifecycleTransfers = completedTransfers + pendingTransfers + cancelledTransfers;
      const averageTicket = completedTransfers > 0 ? totalSent / completedTransfers : 0;
      const commissionableTransfers = commissionableRows.length;
      const commissionPerTransfer = commissionableTransfers > 0 ? totalCommission / commissionableTransfers : 0;
      const averageDailyOutflow = monthlyVolume > 0 ? monthlyVolume / 30 : 0;
      const settlementRate = totalLifecycleTransfers > 0
        ? Math.round((completedTransfers / totalLifecycleTransfers) * 100)
        : 0;

      const activeAgents = isAdmin
        ? activeAgentsResult?.data?.length || 0
        : completedTransfersRows.length > 0
          ? 1
          : 0;

      const agentsBelowThreshold = safeBalances.filter((balance) => Number(balance.balance ?? 0) < 25000).length;
      const totalClients = isAdmin
        ? safeClients.length
        : new Set((safeClients as Array<{ sender_phone?: string | null }>).map((client) => client.sender_phone)).size;

      const stats: DashboardStats = {
        totalBalance: availableBalance + pendingExposure,
        availableBalance,
        reservedBalance: pendingExposure,
        pendingExposure,
        todayTransfers: todayTransfersRows.length,
        totalSent,
        totalClients,
        balancesByCurrency,
        totalCommission,
        todayCommission,
        monthlyCommission,
        yearlyCommission,
        commissionPerTransfer,
        averageTicket,
        todayVolume,
        weeklyVolume,
        monthlyVolume,
        settlementRate,
        activeAgents,
        agentsBelowThreshold,
        projectedTopups24h: estimateProjectedTopups24h(averageDailyOutflow, availableBalance),
        liquidityCoverageDays: estimateLiquidityCoverageDays(availableBalance, averageDailyOutflow),
        floatUtilization: estimateFloatUtilization(pendingExposure, availableBalance),
        pickupReadyTransfers: pickupReadyRows.length,
        pickupReadyAmount,
        completedTransfers,
        pendingTransfers,
        cancelledTransfers,
      };

      return NextResponse.json(stats);
    }

    const [
      { data: balances, error: balancesError },
      { data: walletTransfers, error: walletError },
      { data: receivedAgentTransfers, error: receivedAgentTransfersError },
    ] = await Promise.all([
      adminClient.from('client_balances').select('balance, reserved_balance, currency').eq('client_id', profile.id),
      adminClient
        .from('wallet_transfers')
        .select('status, amount, created_at')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`),
      adminClient
        .from('transfers')
        .select('status, amount, created_at')
        .eq('receiver_user_id', profile.id),
    ]);

    if (balancesError) throw balancesError;
    if (walletError) throw walletError;
    if (receivedAgentTransfersError) throw receivedAgentTransfersError;

    const safeBalances = (balances ?? []) as Array<BalanceRow & { reserved_balance?: number | string | null }>;
    const safeTransfers = (walletTransfers ?? []) as TransferRow[];

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

    const normalizedWalletTransfers = safeTransfers.map((transfer) => ({
      ...transfer,
      status: mapWalletTransferStatus(transfer.status),
    }));
    const normalizedReceivedAgentTransfers = ((receivedAgentTransfers ?? []) as TransferRow[]).map((transfer) => ({
      ...transfer,
      status: normalizeTransferStatus(transfer.status),
    }));
    const clientTransfers = [...normalizedWalletTransfers, ...normalizedReceivedAgentTransfers];

    const completedTransfersRows = clientTransfers.filter((transfer) => isTransferCompleted(transfer.status));
    const pendingTransferRows = clientTransfers.filter((transfer) => isTransferPending(transfer.status));
    const cancelledTransferRows = clientTransfers.filter(
      (transfer) => normalizeTransferStatus(transfer.status) === 'cancelled'
    );
    const todayTransfersRows = clientTransfers.filter((transfer) => isSameOrAfter(transfer.created_at, today));
    const todayCompletedRows = completedTransfersRows.filter((transfer) => isSameOrAfter(transfer.created_at, today));
    const recent7dCompletedRows = completedTransfersRows.filter((transfer) => isSameOrAfter(transfer.created_at, sevenDaysAgo));
    const recent30dCompletedRows = completedTransfersRows.filter((transfer) =>
      isSameOrAfter(transfer.created_at, thirtyDaysAgo)
    );

    const totalSent = sumAmounts(completedTransfersRows);
    const todayVolume = sumAmounts(todayCompletedRows);
    const weeklyVolume = sumAmounts(recent7dCompletedRows);
    const monthlyVolume = sumAmounts(recent30dCompletedRows);
    const completedTransfers = completedTransfersRows.length;
    const pendingTransfers = pendingTransferRows.length;
    const cancelledTransfers = cancelledTransferRows.length;
    const averageTicket = completedTransfers > 0 ? totalSent / completedTransfers : 0;
    const totalLifecycleTransfers = completedTransfers + pendingTransfers + cancelledTransfers;

    const stats: DashboardStats = {
      totalBalance: availableBalance + reservedBalance,
      availableBalance,
      reservedBalance,
      pendingExposure: reservedBalance,
      todayTransfers: todayTransfersRows.length,
      totalSent,
      totalClients: 0,
      balancesByCurrency,
      totalCommission: 0,
      todayCommission: 0,
      monthlyCommission: 0,
      yearlyCommission: 0,
      commissionPerTransfer: 0,
      averageTicket,
      todayVolume,
      weeklyVolume,
      monthlyVolume,
      settlementRate: totalLifecycleTransfers > 0
        ? Math.round((completedTransfers / totalLifecycleTransfers) * 100)
        : 0,
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
