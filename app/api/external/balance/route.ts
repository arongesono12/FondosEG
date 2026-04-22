import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { isAdminRole } from '@/lib/roles';
import { formatCurrency } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }

    if (!await requirePermission(auth, 'balance')) {
      return NextResponse.json({ error: 'Permiso denegado: balance' }, { status: 403 });
    }

    const { user_id, role_access } = auth.apiKey!;
    const adminClient = createAdminClient();

    let balanceData;

    if (isAdminRole(role_access)) {
      const { data: agents } = await adminClient
        .from('agent_balances')
        .select('*, user:users(name, phone)');
      
      const totalBalance = agents?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;
      
      balanceData = {
        role: role_access,
        total_balance: totalBalance,
        currency: 'XAF',
        agents_count: agents?.length || 0,
        agents: agents?.map(a => ({
          id: a.agent_id,
          name: a.user?.name,
          phone: a.user?.phone,
          balance: a.balance,
          cash_balance: a.cash_balance || 0,
        })) || [],
      };
    } else if (role_access === 'gestor') {
      const { data: balance } = await adminClient
        .from('agent_balances')
        .select('*')
        .eq('agent_id', user_id)
        .single();

      balanceData = {
        role: 'gestor',
        balance: balance?.balance || 0,
        cash_balance: balance?.cash_balance || 0,
        currency: balance?.currency || 'XAF',
        formatted: formatCurrency(balance?.balance || 0),
      };
    } else {
      const { data: balance } = await adminClient
        .from('client_balances')
        .select('*')
        .eq('client_id', user_id)
        .single();

      balanceData = {
        role: 'cliente',
        balance: balance?.balance || 0,
        currency: balance?.currency || 'XAF',
        formatted: formatCurrency(balance?.balance || 0),
      };
    }

    return NextResponse.json({
      success: true,
      data: balanceData,
    });

  } catch (error) {
    console.error('API Balance Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
