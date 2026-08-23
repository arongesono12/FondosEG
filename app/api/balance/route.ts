import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSelfOrAdmin } from '@/lib/server/authz';
import { releaseExpiredClientWithdrawals } from '@/lib/server/financial-operations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const profile = await requireProfile();
    const targetUserId = userId || profile.id;
    if (userId) {
      requireSelfOrAdmin(profile, userId);
    }

    const adminClient = createAdminClient();

    // Un código de retiro caducado deja de ser cobrable, pero su retención
    // sigue restando saldo disponible hasta que alguien la libera. Se barre
    // aquí porque este es el punto por el que pasa toda lectura de saldo del
    // cliente: así nunca ve retenido un importe que ya nadie puede cobrar.
    try {
      await releaseExpiredClientWithdrawals(targetUserId);
    } catch (expiryError) {
      console.error('No se pudieron liberar los retiros caducados:', expiryError);
    }

    const { data: balances, error } = await adminClient
      .from('client_balances')
      .select('*')
      .eq('client_id', targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ balances });
  } catch (error) {
    console.error('Balance API error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
