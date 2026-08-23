import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { lookupClientWithdrawal, payOutClientWithdrawal } from '@/services/withdrawal';

/**
 * Entrega de efectivo contra un código de retiro emitido por el cliente.
 *
 * Como en el pago de un envío de ventanilla, el gestor cambia efectivo por
 * float: `cash_balance` baja y `balance` sube. La diferencia es que el débito
 * de la billetera consume una retención que hizo el propio titular.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'gestor');

    const body = (await request.json()) as { withdrawal_code?: string; withdrawal_id?: string };
    const code = (body.withdrawal_code || '').trim().toUpperCase();
    const withdrawalId = body.withdrawal_id;

    if (!code && !withdrawalId) {
      return NextResponse.json({ success: false, error: 'Código o ID requerido' }, { status: 400 });
    }

    let resolvedId = withdrawalId;
    if (!resolvedId) {
      const { withdrawal, error } = await lookupClientWithdrawal(code);
      if (!withdrawal) {
        return NextResponse.json(
          { success: false, error: error || 'Retiro no encontrado' },
          { status: 404 }
        );
      }
      resolvedId = withdrawal.id;
    }

    const result = await payOutClientWithdrawal(resolvedId, profile.id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error('[POST /api/withdrawals/payout]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
