import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const { id } = await context.params;
    const body = (await request.json()) as { amount: number; description?: string };

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Monto inválido' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: currentBalance, error: fetchError } = await adminClient
      .from('agent_balances')
      .select('balance')
      .eq('agent_id', id)
      .single();

    let previousBalance = 0;
    let newBalance = amount;

    if (fetchError || !currentBalance) {
      const { error: insertError } = await adminClient.from('agent_balances').insert({
        agent_id: id,
        balance: amount,
        currency: 'XAF',
      });
      if (insertError) {
        return NextResponse.json({ success: false, error: 'Error al crear el registro de saldo' }, { status: 500 });
      }
    } else {
      previousBalance = Number(currentBalance.balance) || 0;
      newBalance = previousBalance + amount;
      const { error: updateError } = await adminClient
        .from('agent_balances')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('agent_id', id);
      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }
    }

    await adminClient.from('balance_transactions').insert({
      agent_id: id,
      type: 'topup',
      amount,
      previous_balance: previousBalance,
      new_balance: newBalance,
      description: body.description || 'Recarga de saldo',
    });

    await adminClient.from('activity_logs').insert({
      user_id: profile.id,
      action: 'topup_agent_balance',
      entity_type: 'balance',
      entity_id: id,
      metadata: {
        target_user_id: id,
        amount,
        previous_balance: previousBalance,
        new_balance: newBalance,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/agents/[id]/topup]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
