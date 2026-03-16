import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const { id } = await context.params;
    const body = (await request.json()) as { newBalance?: number };
    const newBalance = Number(body.newBalance ?? 0);
    if (!Number.isFinite(newBalance) || newBalance < 0) {
      return NextResponse.json({ success: false, error: 'Saldo inválido' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: currentBalance, error: fetchError } = await adminClient
      .from('agent_balances')
      .select('balance')
      .eq('agent_id', id)
      .single();

    const previousBalance = Number(currentBalance?.balance ?? 0);
    const nowIso = new Date().toISOString();

    if (fetchError || !currentBalance) {
      const { error: insertError } = await adminClient.from('agent_balances').insert({
        agent_id: id,
        balance: newBalance,
        currency: 'XAF',
      });
      if (insertError) {
        return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
      }
    } else {
      const { error: updateError } = await adminClient
        .from('agent_balances')
        .update({ balance: newBalance, updated_at: nowIso })
        .eq('agent_id', id);
      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }
    }

    await adminClient.from('balance_transactions').insert({
      agent_id: id,
      type: 'reset',
      amount: newBalance - previousBalance,
      previous_balance: previousBalance,
      new_balance: newBalance,
      description: `Restablecimiento de saldo por administrador. Anterior: ${previousBalance}, Nuevo: ${newBalance}`,
    });

    await adminClient.from('activity_logs').insert({
      user_id: profile.id,
      action: 'reset_agent_balance',
      entity_type: 'balance',
      entity_id: id,
      metadata: { previous_balance: previousBalance, new_balance: newBalance, agent_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/agents/[id]/reset]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
