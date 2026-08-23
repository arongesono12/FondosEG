import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import {
  cancelClientWithdrawal,
  createClientWithdrawal,
  getClientWithdrawals,
} from '@/services/withdrawal';

/**
 * Retiros de efectivo del propio cliente.
 *
 * El titular emite aquí su vale y lo presenta en el gestor que prefiera. Es la
 * única vía por la que un gestor puede entregar efectivo con cargo a una
 * billetera: los envíos acreditados a una cuenta ya nacen liquidados y su
 * código de envío no se puede cobrar en ventanilla.
 */
export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'cliente');

    const withdrawals = await getClientWithdrawals(profile.id);
    return NextResponse.json(withdrawals);
  } catch (error) {
    console.error('[GET /api/withdrawals]', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'cliente');

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'cancel') {
      const result = await cancelClientWithdrawal(String(data.withdrawal_id || ''), profile.id);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action && action !== 'create') {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const result = await createClientWithdrawal(profile.id, {
      amount: Number(data.amount),
      currency: data.currency,
      destination_city: data.destination_city,
      notes: data.notes,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('[POST /api/withdrawals]', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
