import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { lookupClientWithdrawal } from '@/services/withdrawal';

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, ['gestor', 'admin']);

    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
    }

    const { withdrawal, error } = await lookupClientWithdrawal(code);
    if (!withdrawal) {
      return NextResponse.json({ error: error || 'Retiro no encontrado' }, { status: 404 });
    }

    return NextResponse.json(withdrawal);
  } catch (err) {
    console.error('[GET /api/withdrawals/lookup]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
