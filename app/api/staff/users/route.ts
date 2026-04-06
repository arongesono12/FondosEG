import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSuperAdmin } from '@/lib/server/authz';
import type { UserRole } from '@/types';

type ManagedRole = Extract<UserRole, 'gestor' | 'cliente'>;

type ManagedUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: ManagedRole;
  is_active: boolean;
  created_at: string;
};

type TransferPointer = {
  id: string;
  agent_id?: string | null;
  sender_id?: string | null;
  receiver_user_id?: string | null;
  created_at: string;
};

type WalletPointer = {
  id: string;
  sender_id?: string | null;
  receiver_id?: string | null;
  created_at: string;
};

type BalancePointer = {
  id: string;
  agent_id: string;
  type?: string | null;
  created_at: string;
};

type ActivityPointer = {
  id: string;
  user_id: string;
  action: string;
  created_at: string;
};

type SupportPointer = {
  id: string;
  user_id: string;
  request_type?: string | null;
  created_at: string;
};

type UserSummary = {
  movement_count: number;
  last_movement_at: string | null;
  last_movement_label: string | null;
};

function updateSummary(
  summaries: Map<string, UserSummary>,
  userId: string | null | undefined,
  createdAt: string,
  label: string
) {
  if (!userId || !summaries.has(userId)) return;

  const current = summaries.get(userId)!;
  current.movement_count += 1;

  if (!current.last_movement_at || new Date(createdAt) > new Date(current.last_movement_at)) {
    current.last_movement_at = createdAt;
    current.last_movement_label = label;
  }
}

function formatActionLabel(action: string): string {
  switch (action) {
    case 'create_client_transfer':
      return 'Transferencia de cliente';
    case 'create_agent':
      return 'Alta de gestor';
    case 'topup_agent_balance':
      return 'Recarga de saldo';
    case 'reset_agent_balance':
      return 'Reinicio de saldo';
    default:
      return action.replace(/_/g, ' ');
  }
}

export async function GET() {
  try {
    const profile = await requireProfile();
    requireSuperAdmin(profile);

    const adminClient = createAdminClient();
    const { data: users, error: usersError } = await adminClient
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at')
      .in('role', ['gestor', 'cliente'])
      .order('created_at', { ascending: false });

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const managedUsers = (users ?? []) as ManagedUserRow[];
    if (managedUsers.length === 0) {
      return NextResponse.json([]);
    }

    const userIds = managedUsers.map((user) => user.id);
    const summaries = new Map<string, UserSummary>(
      managedUsers.map((user) => [
        user.id,
        { movement_count: 0, last_movement_at: null, last_movement_label: null },
      ])
    );

    const [
      { data: transfersByAgent },
      { data: transfersBySender },
      { data: transfersByReceiver },
      { data: walletBySender },
      { data: walletByReceiver },
      { data: balanceTransactions },
      { data: activityLogs },
      { data: supportMessages },
    ] = await Promise.all([
      adminClient.from('transfers').select('id, agent_id, created_at').in('agent_id', userIds),
      adminClient.from('transfers').select('id, sender_id, created_at').in('sender_id', userIds),
      adminClient.from('transfers').select('id, receiver_user_id, created_at').in('receiver_user_id', userIds),
      adminClient.from('wallet_transfers').select('id, sender_id, created_at').in('sender_id', userIds),
      adminClient.from('wallet_transfers').select('id, receiver_id, created_at').in('receiver_id', userIds),
      adminClient.from('balance_transactions').select('id, agent_id, type, created_at').in('agent_id', userIds),
      adminClient.from('activity_logs').select('id, user_id, action, created_at').in('user_id', userIds),
      adminClient.from('support_messages').select('id, user_id, request_type, created_at').in('user_id', userIds),
    ]);

    ((transfersByAgent ?? []) as TransferPointer[]).forEach((item) => {
      updateSummary(summaries, item.agent_id, item.created_at, 'Transferencia gestionada');
    });

    ((transfersBySender ?? []) as TransferPointer[]).forEach((item) => {
      updateSummary(summaries, item.sender_id, item.created_at, 'Transferencia creada');
    });

    ((transfersByReceiver ?? []) as TransferPointer[]).forEach((item) => {
      updateSummary(summaries, item.receiver_user_id, item.created_at, 'Transferencia recibida');
    });

    ((walletBySender ?? []) as WalletPointer[]).forEach((item) => {
      updateSummary(summaries, item.sender_id, item.created_at, 'Billetera enviada');
    });

    ((walletByReceiver ?? []) as WalletPointer[]).forEach((item) => {
      updateSummary(summaries, item.receiver_id, item.created_at, 'Billetera recibida');
    });

    ((balanceTransactions ?? []) as BalancePointer[]).forEach((item) => {
      updateSummary(
        summaries,
        item.agent_id,
        item.created_at,
        item.type ? `Movimiento de saldo: ${item.type}` : 'Movimiento de saldo'
      );
    });

    ((activityLogs ?? []) as ActivityPointer[]).forEach((item) => {
      updateSummary(summaries, item.user_id, item.created_at, formatActionLabel(item.action));
    });

    ((supportMessages ?? []) as SupportPointer[]).forEach((item) => {
      updateSummary(
        summaries,
        item.user_id,
        item.created_at,
        item.request_type ? `Soporte: ${item.request_type}` : 'Solicitud de soporte'
      );
    });

    return NextResponse.json(
      managedUsers.map((user) => ({
        ...user,
        movement_count: summaries.get(user.id)?.movement_count || 0,
        last_movement_at: summaries.get(user.id)?.last_movement_at || null,
        last_movement_label: summaries.get(user.id)?.last_movement_label || null,
      }))
    );
  } catch (err) {
    console.error('[GET /api/staff/users]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
