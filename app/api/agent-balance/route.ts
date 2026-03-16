import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSelfOrAdmin } from '@/lib/server/authz';
import type { AgentBalance } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || profile.id;

    requireSelfOrAdmin(profile, agentId);

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.from('agent_balances').select('*').eq('agent_id', agentId).single();
    if (error) return NextResponse.json(null);
    return NextResponse.json((data || null) as AgentBalance | null);
  } catch (err) {
    console.error('[GET /api/agent-balance]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

