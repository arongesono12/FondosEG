import { createAdminClient } from '@/lib/supabase/admin';

interface AgentTransferPayload {
  agentId: string;
  actorUserId: string;
  transferCode: string;
  senderName: string;
  senderPhone: string;
  senderDocumentType?: string;
  senderDocumentNumber?: string;
  receiverName: string;
  receiverPhone: string;
  receiverDocumentType?: string;
  receiverDocumentNumber?: string;
  destinationCity: string;
  destinationCountry?: string;
  amount: number;
  currency: string;
  notes?: string;
  receiverUserId?: string | null;
}

interface WalletTransferPayload {
  senderId: string;
  receiverId: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  amount: number;
  currency: string;
  verificationCode: string;
  notes?: string;
  originChannel?: string;
}

interface DirectWalletTransferPayload {
  senderId: string;
  receiverName: string;
  receiverPhone: string;
  amount: number;
  currency: string;
  notes?: string;
  originChannel?: string;
}

interface CreateClientWithdrawalPayload {
  clientId: string;
  withdrawalCode: string;
  amount: number;
  currency: string;
  destinationCity?: string | null;
  notes?: string | null;
  expiresInHours?: number;
}

interface CorrectAgentTransferPayload {
  transferId: string;
  actorUserId: string;
  senderName: string;
  senderPhone: string;
  senderDocumentType?: string;
  senderDocumentNumber?: string;
  receiverName: string;
  receiverPhone: string;
  receiverDocumentType?: string;
  receiverDocumentNumber?: string;
  destinationCity: string;
  destinationCountry?: string;
  amount: number;
  currency: string;
  notes?: string;
  receiverUserId?: string | null;
}

function extractRpcData<T>(data: unknown): T {
  return data as T;
}

export async function createAgentTransferOperation(payload: AgentTransferPayload) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc('create_agent_transfer_operation', {
    p_agent_id: payload.agentId,
    p_actor_user_id: payload.actorUserId,
    p_transfer_code: payload.transferCode,
    p_sender_name: payload.senderName,
    p_sender_phone: payload.senderPhone,
    p_sender_document_type: payload.senderDocumentType ?? null,
    p_sender_document_number: payload.senderDocumentNumber ?? null,
    p_receiver_name: payload.receiverName,
    p_receiver_phone: payload.receiverPhone,
    p_receiver_document_type: payload.receiverDocumentType ?? null,
    p_receiver_document_number: payload.receiverDocumentNumber ?? null,
    p_destination_city: payload.destinationCity,
    p_destination_country: payload.destinationCountry ?? null,
    p_amount: payload.amount,
    p_currency: payload.currency,
    p_notes: payload.notes ?? null,
    p_receiver_user_id: payload.receiverUserId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    transfer: Record<string, unknown>;
    previous_balance: number;
    new_balance: number;
  }>(data);
}

export async function markAgentTransferPaidOut(transferId: string, actorUserId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('pay_out_agent_transfer_operation', {
    p_transfer_id: transferId,
    p_actor_user_id: actorUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{ transfer: Record<string, unknown> }>(data);
}

export async function correctAgentTransferOperation(payload: CorrectAgentTransferPayload) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('correct_agent_transfer_operation', {
    p_transfer_id: payload.transferId,
    p_actor_user_id: payload.actorUserId,
    p_sender_name: payload.senderName,
    p_sender_phone: payload.senderPhone,
    p_sender_document_type: payload.senderDocumentType ?? null,
    p_sender_document_number: payload.senderDocumentNumber ?? null,
    p_receiver_name: payload.receiverName,
    p_receiver_phone: payload.receiverPhone,
    p_receiver_document_type: payload.receiverDocumentType ?? null,
    p_receiver_document_number: payload.receiverDocumentNumber ?? null,
    p_destination_city: payload.destinationCity,
    p_destination_country: payload.destinationCountry ?? null,
    p_amount: payload.amount,
    p_currency: payload.currency,
    p_notes: payload.notes ?? null,
    p_receiver_user_id: payload.receiverUserId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    transfer: Record<string, unknown>;
    previous_amount: number;
    new_amount: number;
    amount_delta: number;
    agent_balance_after: number;
    agent_cash_after: number;
  }>(data);
}

export async function topUpAgentBalanceOperation(
  adminUserId: string,
  agentId: string,
  amount: number,
  description?: string
) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('topup_agent_balance_operation', {
    p_admin_user_id: adminUserId,
    p_agent_id: agentId,
    p_amount: amount,
    p_description: description ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{ previous_balance: number; new_balance: number }>(data);
}

export async function resetAgentBalanceOperation(
  adminUserId: string,
  agentId: string,
  newBalance: number,
  description?: string
) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('reset_agent_balance_operation', {
    p_admin_user_id: adminUserId,
    p_agent_id: agentId,
    p_new_balance: newBalance,
    p_description: description ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{ previous_balance: number; new_balance: number }>(data);
}

export async function createWalletTransferHold(payload: WalletTransferPayload) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('create_wallet_transfer_hold', {
    p_sender_id: payload.senderId,
    p_receiver_id: payload.receiverId,
    p_sender_name: payload.senderName,
    p_sender_phone: payload.senderPhone,
    p_receiver_name: payload.receiverName,
    p_receiver_phone: payload.receiverPhone,
    p_amount: payload.amount,
    p_currency: payload.currency,
    p_verification_code: payload.verificationCode,
    p_notes: payload.notes ?? null,
    p_origin_channel: payload.originChannel ?? 'dashboard',
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    transfer: Record<string, unknown>;
    available_balance: number;
    reserved_balance: number;
  }>(data);
}

export async function createWalletTransferDirectOperation(payload: DirectWalletTransferPayload) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('create_wallet_transfer_direct_operation', {
    p_sender_id: payload.senderId,
    p_receiver_phone: payload.receiverPhone,
    p_receiver_name: payload.receiverName,
    p_amount: payload.amount,
    p_currency: payload.currency,
    p_notes: payload.notes ?? null,
    p_origin_channel: payload.originChannel ?? 'external_api',
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    transfer: Record<string, unknown>;
    new_balance: number;
  }>(data);
}

export async function confirmWalletTransferOperation(
  transferId: string,
  verificationCode: string | null,
  actorUserId: string,
  skipCodeCheck: boolean = false
) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('confirm_wallet_transfer_operation', {
    p_transfer_id: transferId,
    p_verification_code: verificationCode,
    p_actor_user_id: actorUserId,
    p_skip_code_check: skipCodeCheck,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    transfer: Record<string, unknown>;
    sender_available_balance: number;
    sender_reserved_balance: number;
  }>(data);
}

/**
 * Emite un código de retiro contra el saldo del propio cliente.
 *
 * La RPC bloquea la fila del saldo, comprueba el DISPONIBLE (no el bruto) y
 * retiene el importe en la misma transacción en la que crea el vale. Sin esa
 * atomicidad, dos códigos emitidos a la vez podrían comprometer el mismo dinero.
 */
export async function createClientWithdrawalOperation(payload: CreateClientWithdrawalPayload) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('create_client_withdrawal_operation', {
    p_client_id: payload.clientId,
    p_withdrawal_code: payload.withdrawalCode,
    p_amount: payload.amount,
    p_currency: payload.currency,
    p_destination_city: payload.destinationCity ?? null,
    p_notes: payload.notes ?? null,
    p_expires_in_hours: payload.expiresInHours ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    withdrawal: Record<string, unknown>;
    available_balance: number;
    reserved_balance: number;
  }>(data);
}

export async function payOutClientWithdrawalOperation(withdrawalId: string, agentId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('pay_out_client_withdrawal_operation', {
    p_withdrawal_id: withdrawalId,
    p_agent_id: agentId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    withdrawal: Record<string, unknown>;
    client_balance: number;
    client_reserved_balance: number;
    agent_new_balance: number;
    agent_new_cash: number;
  }>(data);
}

export async function cancelClientWithdrawalOperation(withdrawalId: string, actorUserId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('cancel_client_withdrawal_operation', {
    p_withdrawal_id: withdrawalId,
    p_actor_user_id: actorUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    withdrawal: Record<string, unknown>;
    available_balance: number;
    reserved_balance: number;
  }>(data);
}

/**
 * Libera las retenciones de los códigos caducados. Se invoca antes de listar o
 * de consultar saldo para que el cliente nunca vea retenido un importe que ya
 * no respalda ningún vale vivo.
 */
export async function releaseExpiredClientWithdrawals(clientId?: string | null) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('release_expired_client_withdrawals', {
    p_client_id: clientId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Number(data ?? 0);
}

export async function cancelWalletTransferOperation(transferId: string, actorUserId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('cancel_wallet_transfer_operation', {
    p_transfer_id: transferId,
    p_actor_user_id: actorUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{
    transfer: Record<string, unknown>;
    available_balance: number;
    reserved_balance: number;
  }>(data);
}
