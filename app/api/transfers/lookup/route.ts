import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import type { Transfer } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, ['gestor', 'admin']);

    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('transfers')
      .select('*, agent:users!transfers_agent_id_fkey(name, phone)')
      .eq('transfer_code', code)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Transferencia no encontrada o no disponible' }, { status: 404 });
    }

    // Un envío acreditado a una cuenta ya está liquidado: el dinero está en la
    // billetera del beneficiario y sólo él puede sacarlo, con un código de
    // retiro que emite desde su panel. Pagarlo aquí sería entregarlo dos veces.
    if (data.receiver_user_id) {
      return NextResponse.json(
        {
          error:
            'Este envío se acreditó en la billetera del beneficiario. Debe generar su propio código de retiro desde la aplicación.',
        },
        { status: 409 }
      );
    }

    if (!['created', 'available_for_pickup'].includes(data.status)) {
      return NextResponse.json({ error: 'Transferencia no encontrada o no disponible' }, { status: 404 });
    }

    return NextResponse.json(data as Transfer);
  } catch (err) {
    console.error('[GET /api/transfers/lookup]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
