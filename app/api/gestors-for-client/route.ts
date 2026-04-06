import { NextResponse } from 'next/server';
import { AuthzError, requireAuthUser } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const user = await requireAuthUser();

    const adminClient = createAdminClient();

    const { data: transfers, error } = await adminClient
      .from('transfers')
      .select('agent_id, agent:users!transfers_agent_id_fkey(id, name, phone, email)')
      .eq('sender_id', user.id)
      .in('status', ['completed', 'paid_out']);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const agentMap = new Map();
    interface Agent { id: string; name: string; phone: string; email: string }
    
    (transfers as unknown as { agent: Agent }[] || []).forEach((t) => {
      if (t.agent && !agentMap.has(t.agent.id)) {
        agentMap.set(t.agent.id, t.agent);
      }
    });

    const agents = Array.from(agentMap.values()).map((agent: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => ({
      id: agent.id,
      name: agent.name,
      phone: agent.phone,
      email: agent.email,
    }));

    return NextResponse.json(agents);
  } catch (err) {
    console.error('Gestors API error:', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


