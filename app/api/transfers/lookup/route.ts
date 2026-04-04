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
      .in('status', ['created', 'available_for_pickup'])
      .single();

    if (error || !data) {
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
