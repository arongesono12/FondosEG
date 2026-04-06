import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { isAdminRole } from '@/lib/roles';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    if (!await requirePermission(auth, 'history')) {
      return NextResponse.json({ error: 'Permiso denegado: history' }, { status: 403 });
    }

    const { user_id, role_access } = auth.apiKey!;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const adminClient = createAdminClient();

    let transfers = [];

    if (isAdminRole(role_access)) {
      const { data } = await adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name, phone)')
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      transfers = data || [];
    } else if (role_access === 'gestor') {
      const { data } = await adminClient
        .from('transfers')
        .select('*')
        .eq('agent_id', user_id)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      transfers = data || [];
    } else {
      const { data } = await adminClient
        .from('wallet_transfers')
        .select('*')
        .or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      transfers = data || [];
    }

    return NextResponse.json({
      success: true,
      data: transfers,
      pagination: {
        limit,
        offset,
      },
    });

  } catch (error) {
    console.error('API History Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
