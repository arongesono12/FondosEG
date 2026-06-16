import { createAdminClient } from '@/lib/supabase/admin';
import type { RentalPaymentStatus } from '@/lib/server/payments-provider';

function extractRpcData<T>(data: unknown): T {
  return data as T;
}

export interface CreateRentalPaymentPayload {
  rentalId: string;
  actorUserId?: string | null;
  period?: string | null;
  amount?: number | null;
  currency?: string | null;
  paymentMethod?: string | null;
  provider?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createRentalPaymentOperation(payload: CreateRentalPaymentPayload) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('create_rental_payment_operation', {
    p_rental_id: payload.rentalId,
    p_actor_user_id: payload.actorUserId ?? null,
    p_period: payload.period ?? null,
    p_amount: payload.amount ?? 0,
    p_currency: payload.currency ?? null,
    p_payment_method: payload.paymentMethod ?? null,
    p_provider: payload.provider ?? null,
    p_idempotency_key: payload.idempotencyKey ?? null,
    p_metadata: payload.metadata ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{ payment: Record<string, unknown> }>(data);
}

export interface UpdateRentalPaymentStatusPayload {
  paymentId: string;
  status: RentalPaymentStatus;
  providerPaymentId?: string | null;
  providerReference?: string | null;
  providerCheckoutUrl?: string | null;
  failureReason?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function updateRentalPaymentStatusOperation(payload: UpdateRentalPaymentStatusPayload) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('update_rental_payment_status_operation', {
    p_payment_id: payload.paymentId,
    p_status: payload.status,
    p_provider_payment_id: payload.providerPaymentId ?? null,
    p_provider_reference: payload.providerReference ?? null,
    p_provider_checkout_url: payload.providerCheckoutUrl ?? null,
    p_failure_reason: payload.failureReason ?? null,
    p_actor_user_id: payload.actorUserId ?? null,
    p_metadata: payload.metadata ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return extractRpcData<{ payment: Record<string, unknown>; changed: boolean }>(data);
}
