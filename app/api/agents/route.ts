import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import type { AgentWithBalance, UserRole } from '@/types';

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('users')
      .select(
        `
        *,
        agent_balances (balance, currency)
      `
      )
      .eq('role', 'gestor')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result: AgentWithBalance[] = (data || []).map((user: any) => {
      const balanceRecord = user.agent_balances;
      let balance = 0;
      if (balanceRecord) {
        if (Array.isArray(balanceRecord)) balance = balanceRecord[0]?.balance || 0;
        else balance = balanceRecord.balance || 0;
      }
      return { ...user, balance };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/agents]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const body = (await request.json()) as {
      name: string;
      email: string;
      phone: string;
      password: string;
      document_type?: string;
      document_number?: string;
      country?: string;
      city?: string;
    };

    if (!body?.name || !body?.email || !body?.phone || !body?.password) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: authData, error } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        name: body.name,
        phone: body.phone,
        role: 'gestor' as UserRole,
        document_type: body.document_type,
        document_number: body.document_number,
        country: body.country,
        city: body.city,
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err) {
    console.error('[POST /api/agents]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

