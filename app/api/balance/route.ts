import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSelfOrAdmin } from '@/lib/server/authz';

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
