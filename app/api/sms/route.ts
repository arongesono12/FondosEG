import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

import { queueTransferNotifications, processNotificationOutbox } from '@/lib/server/notification-outbox';

// Twilio and local helpers removed in favor of lib/server/notification-outbox.ts

interface SMSBody {
  transferId: string;
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = createAdminClient();

  try {
    const profile = await requireProfile();
    requireRole(profile, ['admin', 'gestor']);

    const body: SMSBody = await request.json();
    if (!body.transferId) {
      return NextResponse.json({ error: 'transferId is required' }, { status: 400 });
    }

    const { data: transfer, error: transferError } = await supabaseAdmin
      .from('transfers')
      .select('id, transfer_code, agent_id, sender_name, sender_phone, receiver_name, receiver_phone, destination_city, amount, currency, receiver_user_id, wallet_credited_at')
      .eq('id', body.transferId)
      .single();

    if (transferError || !transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    if (profile.role === 'gestor' && transfer.agent_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Reuse the unified notification queue.
    try {
      await queueTransferNotifications({
        transferId: transfer.id,
        transferCode: transfer.transfer_code,
        senderPhone: transfer.sender_phone,
        receiverPhone: transfer.receiver_phone,
        senderName: transfer.sender_name,
        receiverName: transfer.receiver_name,
        amount: Number(transfer.amount),
        currency: transfer.currency,
        destinationCity: transfer.destination_city,
        receiverUserId: transfer.receiver_user_id,
        settledToWallet: Boolean(transfer.receiver_user_id && transfer.wallet_credited_at),
      });

      const stats = await processNotificationOutbox(5);

      return NextResponse.json({
        success: true,
        processed: stats.processed,
        sent: stats.sent,
        failed: stats.failed,
      });
    } catch (notifErr: unknown) {
      const message = notifErr instanceof Error ? notifErr.message : 'Unknown error';
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('SMS Error:', errorMessage);
    if (error instanceof AuthzError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
