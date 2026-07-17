import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { getAuthErrorMessage } from '@/lib/supabase/auth-errors';
import { provisionUserAccount } from '@/lib/server/user-provisioning';
import type { AgentWithBalance, UserRole } from '@/types';

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('users')
      .select(
        `
        *,
        agent_balances (balance, cash_balance, currency)
      `
      )
      .eq('role', 'gestor')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const agentIds = (data as { id: string }[] || []).map((user) => user.id);
    const topupMap = new Map<string, { total: number; lastTopup?: string }>();
    if (agentIds.length > 0) {
      const { data: topups, error: topupError } = await adminClient
        .from('balance_transactions')
        .select('agent_id, amount, created_at')
        .in('agent_id', agentIds)
        .eq('type', 'topup');
      if (topupError) throw topupError;

      (topups as { agent_id: string; amount: number; created_at: string }[] || []).forEach((row) => {
        const agentId = row.agent_id as string;
        const amount = Number(row.amount || 0);
        const existing = topupMap.get(agentId);
        if (!existing) {
          topupMap.set(agentId, { total: amount, lastTopup: row.created_at });
          return;
        }
        existing.total += amount;
        if (!existing.lastTopup || new Date(row.created_at) > new Date(existing.lastTopup)) {
          existing.lastTopup = row.created_at;
        }
      });
    }

    type AgentRow = AgentWithBalance & {
      agent_balances?: { balance?: number; cash_balance?: number } | Array<{ balance?: number; cash_balance?: number }>;
    };
    const result: AgentWithBalance[] = ((data || []) as AgentRow[]).map((user) => {
      const balanceRecord = user.agent_balances;
      let balance = 0;
      let cashBalance = 0;
      if (balanceRecord) {
        if (Array.isArray(balanceRecord)) {
          balance = balanceRecord[0]?.balance || 0;
          cashBalance = balanceRecord[0]?.cash_balance || 0;
        } else {
          balance = balanceRecord.balance || 0;
          cashBalance = balanceRecord.cash_balance || 0;
        }
      }
      const topupInfo = topupMap.get(user.id);
      return {
        ...user,
        balance,
        cash_balance: cashBalance,
        topup_total: topupInfo?.total || 0,
        last_topup_at: topupInfo?.lastTopup,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/agents]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const body = (await request.json()) as {
      name: string;
      email: string;
      phone: string;
      password: string;
      document_type?: string;
      document_number?: string;
      country?: string;
      city?: string;
    };

    if (!body?.name || !body?.email || !body?.phone || !body?.password) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { user: authUser } = await provisionUserAccount(adminClient, {
      email: body.email,
      password: body.password,
      name: body.name,
      phone: body.phone,
      role: 'gestor' as UserRole,
      documentType: body.document_type,
      documentNumber: body.document_number,
      country: body.country,
      city: body.city,
    });

    await adminClient.from('activity_logs').insert({
      user_id: profile.id,
      action: 'create_agent',
      entity_type: 'user',
      entity_id: authUser.id ?? null,
      metadata: {
        created_role: 'gestor',
        email: body.email,
        phone: body.phone,
      },
    });

    return NextResponse.json({ success: true, user: authUser });
  } catch (err) {
    console.error('[POST /api/agents]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    if (err instanceof Error) {
      return NextResponse.json({ success: false, error: getAuthErrorMessage(err, 'No se pudo crear el gestor.') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: getAuthErrorMessage(err, 'No se pudo crear el gestor.') }, { status: 500 });
  }
}

