import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';
import { calculateCommission } from '@/lib/tariffs';
import type { DashboardStats } from '@/types';

export async function GET() {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    if (profile.role === 'admin') {
      const { data: balances } = await adminClient.from('agent_balances').select('balance, currency');

      const { data: todayTransfers } = await adminClient
        .from('transfers')
        .select('id')
        .gte('created_at', todayStr)
        .eq('status', 'completed');

      const { data: allTransfers } = await adminClient
        .from('transfers')
        .select('amount')
        .eq('status', 'completed');

      const { data: todayAllTransfers } = await adminClient
        .from('transfers')
        .select('amount')
        .gte('created_at', todayStr)
        .eq('status', 'completed');

      const { data: allUsers } = await adminClient.from('users').select('id').eq('role', 'cliente');

      const { data: allTransfersStatus } = await adminClient.from('transfers').select('status');

      const perCurrency: Record<string, number> = {};
      balances?.forEach((b: any) => {
        const cur = b?.currency || 'XAF';
        perCurrency[cur] = (perCurrency[cur] ?? 0) + Number(b?.balance ?? 0);
      });

      const totalBalance = Object.values(perCurrency).reduce((a, b) => a + b, 0);
      const totalCommission = (allTransfers ?? []).reduce((sum, t) => sum + calculateCommission(Number(t.amount)), 0);
      const todayCommission = (todayAllTransfers ?? []).reduce((sum, t) => sum + calculateCommission(Number(t.amount)), 0);

      const completedCount = allTransfers?.length || 0;
      const commissionPerTransfer = completedCount > 0 ? totalCommission / completedCount : 0;

      const completedTransfers = allTransfersStatus?.filter((t: any) => t.status === 'completed').length || 0;
      const pendingTransfers = allTransfersStatus?.filter((t: any) => t.status === 'created').length || 0;
      const cancelledTransfers = allTransfersStatus?.filter((t: any) => t.status === 'cancelled').length || 0;

      const stats: DashboardStats = {
        totalBalance,
        todayTransfers: todayTransfers?.length || 0,
        totalSent: (allTransfers ?? []).reduce((sum, t) => sum + Number(t.amount), 0),
        totalClients: allUsers?.length || 0,
        balancesByCurrency: perCurrency,
        totalCommission,
        todayCommission,
        commissionPerTransfer,
        completedTransfers,
        pendingTransfers,
        cancelledTransfers,
      };

      return NextResponse.json(stats);
    }

    if (profile.role === 'gestor') {
      const { data: balances } = await adminClient
        .from('agent_balances')
        .select('balance, currency')
        .eq('agent_id', profile.id);

      const { data: todayTransfers } = await adminClient
        .from('transfers')
        .select('id, amount')
        .eq('agent_id', profile.id)
        .gte('created_at', todayStr)
        .eq('status', 'completed');

      const { data: allTransfers } = await adminClient
        .from('transfers')
        .select('id, amount')
        .eq('agent_id', profile.id)
        .eq('status', 'completed');

      const { data: clients } = await adminClient.from('transfers').select('sender_phone').eq('agent_id', profile.id);

      const { data: allAgentTransfers } = await adminClient.from('transfers').select('status').eq('agent_id', profile.id);

      const perCurrency: Record<string, number> = {};
      balances?.forEach((b: any) => {
        const cur = b?.currency || 'XAF';
        perCurrency[cur] = (perCurrency[cur] ?? 0) + Number(b?.balance ?? 0);
      });

      const totalBalance = Object.values(perCurrency).reduce((a, b) => a + b, 0);
      const uniqueClients = new Set((clients ?? []).map((c: any) => c.sender_phone));

      const totalCommission = (allTransfers ?? []).reduce((sum, t) => sum + calculateCommission(Number(t.amount)), 0);
      const todayCommission = (todayTransfers ?? []).reduce((sum, t) => sum + calculateCommission(Number(t.amount)), 0);

      const completedCount = allTransfers?.length || 0;
      const commissionPerTransfer = completedCount > 0 ? totalCommission / completedCount : 0;

      const completedTransfers = allAgentTransfers?.filter((t: any) => t.status === 'completed').length || 0;
      const pendingTransfers = allAgentTransfers?.filter((t: any) => t.status === 'created').length || 0;
      const cancelledTransfers = allAgentTransfers?.filter((t: any) => t.status === 'cancelled').length || 0;

      const stats: DashboardStats = {
        totalBalance,
        todayTransfers: todayTransfers?.length || 0,
        totalSent: (allTransfers ?? []).reduce((sum, t) => sum + Number(t.amount), 0),
        totalClients: uniqueClients.size,
        balancesByCurrency: perCurrency,
        totalCommission,
        todayCommission,
        commissionPerTransfer,
        completedTransfers,
        pendingTransfers,
        cancelledTransfers,
      };

      return NextResponse.json(stats);
    }

    // cliente
    const { data: balances } = await adminClient
      .from('client_balances')
      .select('balance, currency')
      .eq('client_id', profile.id);

    const perCurrency: Record<string, number> = {};
    balances?.forEach((b: any) => {
      const cur = b?.currency || 'XAF';
      perCurrency[cur] = (perCurrency[cur] ?? 0) + Number(b?.balance ?? 0);
    });
    const totalBalance = Object.values(perCurrency).reduce((a, b) => a + b, 0);

    const { data: walletTransfers } = await adminClient
      .from('wallet_transfers')
      .select('status, amount, created_at')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);

    const { data: walletTodayTransfers } = await adminClient
      .from('wallet_transfers')
      .select('id')
      .eq('sender_id', profile.id)
      .gte('created_at', todayStr);

    const { data: completedWallet } = await adminClient
      .from('wallet_transfers')
      .select('amount')
      .eq('sender_id', profile.id)
      .eq('status', 'confirmed');

    const completedTransfers = (walletTransfers ?? []).filter((t: any) => t.status === 'confirmed').length;
    const pendingTransfers = (walletTransfers ?? []).filter((t: any) => t.status === 'pending').length;
    const cancelledTransfers = (walletTransfers ?? []).filter((t: any) => t.status === 'cancelled' || t.status === 'expired').length;

    const stats: DashboardStats = {
      totalBalance,
      todayTransfers: walletTodayTransfers?.length || 0,
      totalSent: (completedWallet ?? []).reduce((sum, t) => sum + Number(t.amount), 0),
      totalClients: 0,
      balancesByCurrency: perCurrency,
      totalCommission: 0,
      todayCommission: 0,
      commissionPerTransfer: 0,
      completedTransfers,
      pendingTransfers,
      cancelledTransfers,
    };

    return NextResponse.json(stats);
  } catch (err) {
    return handleRouteError(err, 'GET /api/dashboard/stats');
  }
}
