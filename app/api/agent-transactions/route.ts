import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSelfOrAdmin } from '@/lib/server/authz';
import type { BalanceTransaction } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || profile.id;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    requireSelfOrAdmin(profile, agentId);

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('balance_transactions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json((data || []) as BalanceTransaction[]);
  } catch (err) {
    console.error('[GET /api/agent-transactions]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

