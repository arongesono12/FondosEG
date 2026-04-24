import { createAdminClient } from '@/lib/supabase/admin';
import type { WalletTransfer, CreateWalletTransferData, ConfirmWalletTransferData } from '@/types';
import { queueWalletVerificationInternal, queueWalletConfirmationInternal } from '@/lib/server/notification-outbox';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createWalletTransfer(
  senderId: string,
  data: CreateWalletTransferData
): Promise<{ success: boolean; transfer?: WalletTransfer; error?: string }> {
  const adminClient = createAdminClient();

  const { data: sender, error: senderError } = await adminClient
    .from('users')
    .select('*, client_balances(*)')
    .eq('id', senderId)
    .single();

  if (senderError || !sender) {
    return { success: false, error: 'Sender not found' };
  }

  if (sender.role !== 'cliente') {
    return { success: false, error: 'Only clients can use wallet transfers' };
  }

  const { data: receiver, error: receiverError } = await adminClient
    .from('users')
    .select('*')
    .eq('phone', data.receiver_phone)
    .eq('role', 'cliente')
    .single();

  if (receiverError || !receiver) {
    return { success: false, error: 'Receiver not found or is not a client' };
  }

  if (receiver.id === senderId) {
    return { success: false, error: 'Cannot transfer to yourself' };
  }

  const senderBalance = sender.client_balances?.find((b: { currency: string; balance: number }) => b.currency === (data.currency || 'XAF'));
  const currentBalance = senderBalance?.balance || 0;

  if (currentBalance < data.amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  const verificationCode = generateVerificationCode();

  const { data: transfer, error: transferError } = await adminClient
    .from('wallet_transfers')
    .insert({
      sender_id: senderId,
      receiver_id: receiver.id,
      sender_name: sender.name,
      sender_phone: sender.phone,
      receiver_name: data.receiver_name,
      receiver_phone: data.receiver_phone,
      amount: data.amount,
      currency: data.currency || 'XAF',
      verification_code: verificationCode,
      status: 'pending',
      notes: data.notes,
    })
    .select()
    .single();

  if (transferError) {
    return { success: false, error: transferError.message };
  }

  // Queue Verification Notification (Internal only, no SMS)
  try {
    await queueWalletVerificationInternal({
      transferId: transfer.id,
      phone: receiver.phone,
      senderName: sender.name,
      receiverName: data.receiver_name,
      amount: data.amount,
      currency: data.currency || 'XAF',
      code: verificationCode,
    });
  } catch (notifErr) {
    console.error('Failed to queue wallet verification notification:', notifErr);
  }

  return { success: true, transfer };
}

export async function confirmWalletTransfer(
  data: ConfirmWalletTransferData
): Promise<{ success: boolean; transfer?: WalletTransfer; error?: string }> {
  const adminClient = createAdminClient();

  const { data: transfer, error: transferError } = await adminClient
    .from('wallet_transfers')
    .select('*, sender:users!wallet_transfers_sender_id_fkey(*), receiver:users!wallet_transfers_receiver_id_fkey(*)')
    .eq('id', data.transfer_id)
    .single();

  if (transferError || !transfer) {
    return { success: false, error: 'Transfer not found' };
  }

  if (transfer.status !== 'pending') {
    return { success: false, error: 'Transfer is not pending' };
  }

  if (transfer.verification_code !== data.verification_code) {
    return { success: false, error: 'Invalid verification code' };
  }

  const createdAt = new Date(transfer.created_at);
  const now = new Date();
  const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  if (hoursDiff > 24) {
    await adminClient
      .from('wallet_transfers')
      .update({ status: 'expired' })
      .eq('id', transfer.id);
    return { success: false, error: 'Transfer has expired' };
  }

  const { data: senderBalance, error: senderBalanceError } = await adminClient
    .from('client_balances')
    .select('*')
    .eq('client_id', transfer.sender_id)
    .eq('currency', transfer.currency)
    .single();

  if (senderBalanceError || !senderBalance) {
    return { success: false, error: 'Sender balance not found' };
  }

  if (senderBalance.balance < transfer.amount) {
    return { success: false, error: 'Insufficient sender balance' };
  }

  const { data: receiverBalance } = await adminClient
    .from('client_balances')
    .select('*')
    .eq('client_id', transfer.receiver_id)
    .eq('currency', transfer.currency)
    .single();

  await adminClient
    .from('client_balances')
    .update({ balance: senderBalance.balance - transfer.amount })
    .eq('id', senderBalance.id);

  if (receiverBalance) {
    await adminClient
      .from('client_balances')
      .update({ balance: receiverBalance.balance + transfer.amount })
      .eq('id', receiverBalance.id);
  } else {
    await adminClient
      .from('client_balances')
      .insert({
        client_id: transfer.receiver_id,
        currency: transfer.currency,
        balance: transfer.amount,
      });
  }

  const { data: confirmedTransfer, error: confirmError } = await adminClient
    .from('wallet_transfers')
    .update({ 
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', transfer.id)
    .select('*, sender:users!wallet_transfers_sender_id_fkey(*), receiver:users!wallet_transfers_receiver_id_fkey(*)')
    .single();

  if (confirmError) {
    return { success: false, error: confirmError.message };
  }

  // Queue Confirmation Notification (Internal only, no SMS)
  try {
    await queueWalletConfirmationInternal({
      transferId: confirmedTransfer.id,
      phone: confirmedTransfer.receiver.phone,
      senderName: confirmedTransfer.sender.name,
      receiverName: confirmedTransfer.receiver_name,
      amount: confirmedTransfer.amount,
      currency: confirmedTransfer.currency,
    });
  } catch (notifErr) {
    console.error('Failed to queue wallet confirmation notification:', notifErr);
  }

  try {
    await emitWebhookEvent(
      {
        eventType: 'wallet_transfer.confirmed',
        payload: {
          transfer_id: confirmedTransfer.id,
          amount: confirmedTransfer.amount,
          currency: confirmedTransfer.currency,
          status: confirmedTransfer.status,
          sender_name: confirmedTransfer.sender?.name ?? null,
          sender_phone: confirmedTransfer.sender?.phone ?? null,
          receiver_name: confirmedTransfer.receiver_name,
          receiver_phone: confirmedTransfer.receiver?.phone ?? null,
          confirmed_at: confirmedTransfer.confirmed_at ?? null,
          source: 'wallet_confirmation',
        },
      },
      10
    );
  } catch (webhookErr) {
    console.error('Failed to dispatch wallet confirmation webhook:', webhookErr);
  }

  return { success: true, transfer: confirmedTransfer };
}

export async function getWalletTransfer(transferId: string): Promise<WalletTransfer | null> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('wallet_transfers')
    .select('*, sender:users!wallet_transfers_sender_id_fkey(name, phone), receiver:users!wallet_transfers_receiver_id_fkey(name, phone)')
    .eq('id', transferId)
    .single();

  if (error) return null;
  return data;
}

export async function getPendingWalletTransfers(userId: string): Promise<WalletTransfer[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('wallet_transfers')
    .select('*, sender:users!wallet_transfers_sender_id_fkey(name, phone), receiver:users!wallet_transfers_receiver_id_fkey(name, phone)')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function getClientWalletTransfers(clientId: string): Promise<WalletTransfer[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('wallet_transfers')
    .select('*, sender:users!wallet_transfers_sender_id_fkey(name, phone), receiver:users!wallet_transfers_receiver_id_fkey(name, phone)')
    .or(`sender_id.eq.${clientId},receiver_id.eq.${clientId}`)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function cancelWalletTransfer(
  transferId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient();

  const { data: transfer, error: transferError } = await adminClient
    .from('wallet_transfers')
    .select('*')
    .eq('id', transferId)
    .single();

  if (transferError || !transfer) {
    return { success: false, error: 'Transfer not found' };
  }

  if (transfer.sender_id !== userId) {
    return { success: false, error: 'Not authorized to cancel this transfer' };
  }

  if (transfer.status !== 'pending') {
    return { success: false, error: 'Transfer cannot be cancelled' };
  }

  const { error: cancelError } = await adminClient
    .from('wallet_transfers')
    .update({ status: 'cancelled' })
    .eq('id', transferId);

  if (cancelError) {
    return { success: false, error: cancelError.message };
  }

  return { success: true };
}
