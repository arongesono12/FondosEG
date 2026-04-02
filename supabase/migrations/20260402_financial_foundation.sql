BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.client_balances
ADD COLUMN IF NOT EXISTS reserved_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.transfers
ADD COLUMN IF NOT EXISTS receiver_document_type TEXT,
ADD COLUMN IF NOT EXISTS receiver_document_number TEXT,
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pricing_rule_code TEXT,
ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_out_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.wallet_transfers
ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS origin_channel TEXT NOT NULL DEFAULT 'dashboard';

ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS api_secret_hash TEXT,
ADD COLUMN IF NOT EXISTS api_secret_preview TEXT,
ADD COLUMN IF NOT EXISTS rate_limit_window_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_status_check;
ALTER TABLE public.transfers
ADD CONSTRAINT transfers_status_check
CHECK (status IN ('created', 'available_for_pickup', 'paid_out', 'completed', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.financial_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL,
  version TEXT NOT NULL,
  rule_code TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'XAF',
  min_amount DECIMAL(15, 2) NOT NULL,
  max_amount DECIMAL(15, 2) NOT NULL,
  commission_amount DECIMAL(15, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_pricing_rules_lookup
  ON public.financial_pricing_rules(product_code, currency, is_active, min_amount, max_amount);

CREATE TABLE IF NOT EXISTS public.financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ledger_scope TEXT NOT NULL CHECK (ledger_scope IN ('agent', 'client', 'system')),
  event_type TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  reserved_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  available_balance_after DECIMAL(15, 2),
  reserved_balance_after DECIMAL(15, 2),
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_events_owner_created
  ON public.financial_events(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_events_reference
  ON public.financial_events(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'sms' CHECK (kind IN ('sms')),
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status_created
  ON public.notification_outbox(status, created_at);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  message TEXT NOT NULL,
  request_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'cancelled')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_status_created
  ON public.support_messages(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (api_key_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.api_key_usage_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (api_key_id, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_windows_lookup
  ON public.api_key_usage_windows(api_key_id, window_started_at DESC);

INSERT INTO public.financial_pricing_rules (product_code, version, rule_code, currency, min_amount, max_amount, commission_amount)
VALUES
  ('agent_transfer', '2026-default', 'agent-transfer-001', 'XAF', 1000, 20000, 500),
  ('agent_transfer', '2026-default', 'agent-transfer-002', 'XAF', 20001, 50000, 1000),
  ('agent_transfer', '2026-default', 'agent-transfer-003', 'XAF', 50001, 85000, 2000),
  ('agent_transfer', '2026-default', 'agent-transfer-004', 'XAF', 85001, 160000, 2500),
  ('agent_transfer', '2026-default', 'agent-transfer-005', 'XAF', 160001, 250000, 3000),
  ('agent_transfer', '2026-default', 'agent-transfer-006', 'XAF', 250001, 350000, 3500),
  ('agent_transfer', '2026-default', 'agent-transfer-007', 'XAF', 350001, 400000, 4000),
  ('agent_transfer', '2026-default', 'agent-transfer-008', 'XAF', 400001, 500000, 6000),
  ('agent_transfer', '2026-default', 'agent-transfer-009', 'XAF', 500001, 750000, 7000),
  ('agent_transfer', '2026-default', 'agent-transfer-010', 'XAF', 750001, 900000, 9000),
  ('agent_transfer', '2026-default', 'agent-transfer-011', 'XAF', 900001, 1200000, 11000),
  ('agent_transfer', '2026-default', 'agent-transfer-012', 'XAF', 1200001, 1500000, 16000),
  ('agent_transfer', '2026-default', 'agent-transfer-013', 'XAF', 1500001, 2000000, 18000)
ON CONFLICT (rule_code) DO UPDATE
SET
  product_code = EXCLUDED.product_code,
  version = EXCLUDED.version,
  currency = EXCLUDED.currency,
  min_amount = EXCLUDED.min_amount,
  max_amount = EXCLUDED.max_amount,
  commission_amount = EXCLUDED.commission_amount,
  updated_at = NOW();

UPDATE public.api_keys
SET
  api_secret_hash = encode(digest(api_secret, 'sha256'), 'hex'),
  api_secret_preview = concat(left(api_secret, 6), '...', right(api_secret, 4))
WHERE api_secret IS NOT NULL
  AND (api_secret_hash IS NULL OR api_secret_preview IS NULL);

CREATE OR REPLACE FUNCTION public.calculate_tariff_commission(p_amount DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
  v_commission DECIMAL;
BEGIN
  SELECT commission_amount
  INTO v_commission
  FROM public.financial_pricing_rules
  WHERE product_code = 'agent_transfer'
    AND currency = 'XAF'
    AND is_active = TRUE
    AND p_amount BETWEEN min_amount AND max_amount
    AND effective_from <= NOW()
    AND (effective_to IS NULL OR effective_to >= NOW())
  ORDER BY min_amount ASC
  LIMIT 1;

  RETURN COALESCE(v_commission, 0);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.calculate_tariff_rule_code(p_amount DECIMAL)
RETURNS TEXT AS $$
DECLARE
  v_rule_code TEXT;
BEGIN
  SELECT rule_code
  INTO v_rule_code
  FROM public.financial_pricing_rules
  WHERE product_code = 'agent_transfer'
    AND currency = 'XAF'
    AND is_active = TRUE
    AND p_amount BETWEEN min_amount AND max_amount
    AND effective_from <= NOW()
    AND (effective_to IS NULL OR effective_to >= NOW())
  ORDER BY min_amount ASC
  LIMIT 1;

  RETURN v_rule_code;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.topup_agent_balance_operation(
  p_admin_user_id UUID,
  p_agent_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_balance public.agent_balances%ROWTYPE;
  v_previous_balance DECIMAL := 0;
  v_new_balance DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  INSERT INTO public.agent_balances (agent_id, balance, currency)
  VALUES (p_agent_id, 0, 'XAF')
  ON CONFLICT (agent_id) DO NOTHING;

  SELECT *
  INTO v_balance
  FROM public.agent_balances
  WHERE agent_id = p_agent_id
  FOR UPDATE;

  v_previous_balance := COALESCE(v_balance.balance, 0);
  v_new_balance := v_previous_balance + p_amount;

  UPDATE public.agent_balances
  SET balance = v_new_balance, updated_at = v_now
  WHERE agent_id = p_agent_id;

  INSERT INTO public.balance_transactions (
    agent_id,
    type,
    amount,
    previous_balance,
    new_balance,
    description
  )
  VALUES (
    p_agent_id,
    'topup',
    p_amount,
    v_previous_balance,
    v_new_balance,
    COALESCE(p_description, 'Recarga de saldo')
  );

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_admin_user_id,
    'topup_agent_balance',
    'balance',
    p_agent_id,
    jsonb_build_object('agent_id', p_agent_id, 'amount', p_amount, 'previous_balance', v_previous_balance, 'new_balance', v_new_balance),
    v_now
  );

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    currency,
    available_balance_after,
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    p_agent_id,
    p_admin_user_id,
    'agent',
    'topup',
    p_amount,
    'XAF',
    v_new_balance,
    'agent_balance',
    p_agent_id,
    jsonb_build_object('description', COALESCE(p_description, 'Recarga de saldo'))
  );

  RETURN jsonb_build_object(
    'previous_balance', v_previous_balance,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reset_agent_balance_operation(
  p_admin_user_id UUID,
  p_agent_id UUID,
  p_new_balance DECIMAL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_balance public.agent_balances%ROWTYPE;
  v_previous_balance DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_new_balance < 0 THEN
    RAISE EXCEPTION 'Saldo inválido';
  END IF;

  INSERT INTO public.agent_balances (agent_id, balance, currency)
  VALUES (p_agent_id, 0, 'XAF')
  ON CONFLICT (agent_id) DO NOTHING;

  SELECT *
  INTO v_balance
  FROM public.agent_balances
  WHERE agent_id = p_agent_id
  FOR UPDATE;

  v_previous_balance := COALESCE(v_balance.balance, 0);

  UPDATE public.agent_balances
  SET balance = p_new_balance, updated_at = v_now
  WHERE agent_id = p_agent_id;

  INSERT INTO public.balance_transactions (
    agent_id,
    type,
    amount,
    previous_balance,
    new_balance,
    description
  )
  VALUES (
    p_agent_id,
    'reset',
    p_new_balance - v_previous_balance,
    v_previous_balance,
    p_new_balance,
    COALESCE(p_description, 'Restablecimiento de saldo')
  );

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_admin_user_id,
    'reset_agent_balance',
    'balance',
    p_agent_id,
    jsonb_build_object('agent_id', p_agent_id, 'previous_balance', v_previous_balance, 'new_balance', p_new_balance),
    v_now
  );

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    currency,
    available_balance_after,
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    p_agent_id,
    p_admin_user_id,
    'agent',
    'reset',
    p_new_balance - v_previous_balance,
    'XAF',
    p_new_balance,
    'agent_balance',
    p_agent_id,
    jsonb_build_object('description', COALESCE(p_description, 'Restablecimiento de saldo'))
  );

  RETURN jsonb_build_object(
    'previous_balance', v_previous_balance,
    'new_balance', p_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_agent_transfer_operation(
  p_agent_id UUID,
  p_actor_user_id UUID,
  p_transfer_code TEXT,
  p_sender_name TEXT,
  p_sender_phone TEXT,
  p_sender_document_type TEXT DEFAULT NULL,
  p_sender_document_number TEXT DEFAULT NULL,
  p_receiver_name TEXT DEFAULT NULL,
  p_receiver_phone TEXT DEFAULT NULL,
  p_receiver_document_type TEXT DEFAULT NULL,
  p_receiver_document_number TEXT DEFAULT NULL,
  p_destination_city TEXT DEFAULT NULL,
  p_destination_country TEXT DEFAULT NULL,
  p_amount DECIMAL DEFAULT 0,
  p_currency TEXT DEFAULT 'XAF',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_balance public.agent_balances%ROWTYPE;
  v_transfer public.transfers%ROWTYPE;
  v_previous_balance DECIMAL := 0;
  v_new_balance DECIMAL := 0;
  v_commission DECIMAL := 0;
  v_rule_code TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  SELECT *
  INTO v_balance
  FROM public.agent_balances
  WHERE agent_id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el saldo del gestor';
  END IF;

  v_previous_balance := COALESCE(v_balance.balance, 0);
  IF v_previous_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente para realizar la transferencia';
  END IF;

  v_commission := public.calculate_tariff_commission(p_amount);
  v_rule_code := public.calculate_tariff_rule_code(p_amount);
  v_new_balance := v_previous_balance - p_amount;

  INSERT INTO public.transfers (
    transfer_code,
    transfer_type,
    agent_id,
    sender_name,
    sender_phone,
    sender_document_type,
    sender_document_number,
    receiver_name,
    receiver_phone,
    receiver_document_type,
    receiver_document_number,
    destination_city,
    destination_country,
    amount,
    currency,
    status,
    notes,
    available_at,
    commission_amount,
    pricing_rule_code
  )
  VALUES (
    p_transfer_code,
    'agent',
    p_agent_id,
    p_sender_name,
    p_sender_phone,
    p_sender_document_type,
    p_sender_document_number,
    p_receiver_name,
    p_receiver_phone,
    p_receiver_document_type,
    p_receiver_document_number,
    p_destination_city,
    p_destination_country,
    p_amount,
    p_currency,
    'available_for_pickup',
    p_notes,
    v_now,
    v_commission,
    v_rule_code
  )
  RETURNING * INTO v_transfer;

  UPDATE public.agent_balances
  SET balance = v_new_balance, updated_at = v_now
  WHERE agent_id = p_agent_id;

  INSERT INTO public.balance_transactions (
    agent_id,
    type,
    amount,
    previous_balance,
    new_balance,
    reference_id,
    reference_type,
    description
  )
  VALUES (
    p_agent_id,
    'transfer',
    -p_amount,
    v_previous_balance,
    v_new_balance,
    v_transfer.id,
    'transfer',
    concat('Transferencia: ', p_transfer_code)
  );

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_actor_user_id,
    'create_transfer',
    'transfer',
    v_transfer.id,
    jsonb_build_object(
      'transfer_code', p_transfer_code,
      'amount', p_amount,
      'status', 'available_for_pickup',
      'commission_amount', v_commission,
      'pricing_rule_code', v_rule_code
    ),
    v_now
  );

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    currency,
    available_balance_after,
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    p_agent_id,
    p_actor_user_id,
    'agent',
    'transfer_created',
    -p_amount,
    p_currency,
    v_new_balance,
    'transfer',
    v_transfer.id,
    jsonb_build_object('commission_amount', v_commission, 'pricing_rule_code', v_rule_code)
  );

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'previous_balance', v_previous_balance,
    'new_balance', v_new_balance,
    'commission_amount', v_commission,
    'pricing_rule_code', v_rule_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.pay_out_agent_transfer_operation(
  p_transfer_id UUID,
  p_actor_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_transfer public.transfers%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_transfer
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status NOT IN ('created', 'available_for_pickup') THEN
    RAISE EXCEPTION 'La transferencia no está lista para pago';
  END IF;

  UPDATE public.transfers
  SET
    status = 'paid_out',
    completed_at = v_now,
    paid_out_at = v_now,
    paid_out_by = p_actor_user_id
  WHERE id = p_transfer_id
  RETURNING * INTO v_transfer;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_actor_user_id,
    'pay_out_transfer',
    'transfer',
    v_transfer.id,
    jsonb_build_object('transfer_code', v_transfer.transfer_code, 'amount', v_transfer.amount),
    v_now
  );

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    currency,
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    v_transfer.agent_id,
    p_actor_user_id,
    'agent',
    'transfer_paid_out',
    0,
    v_transfer.currency,
    'transfer',
    v_transfer.id,
    jsonb_build_object('transfer_code', v_transfer.transfer_code)
  );

  RETURN jsonb_build_object('transfer', to_jsonb(v_transfer));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_wallet_transfer_hold(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_sender_name TEXT,
  p_sender_phone TEXT,
  p_receiver_name TEXT,
  p_receiver_phone TEXT,
  p_amount DECIMAL,
  p_currency TEXT DEFAULT 'XAF',
  p_verification_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_origin_channel TEXT DEFAULT 'dashboard'
)
RETURNS JSONB AS $$
DECLARE
  v_sender_balance public.client_balances%ROWTYPE;
  v_transfer public.wallet_transfers%ROWTYPE;
  v_available_balance DECIMAL := 0;
  v_reserved_balance DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
  VALUES (p_sender_id, 0, 0, p_currency)
  ON CONFLICT (client_id) DO NOTHING;

  SELECT *
  INTO v_sender_balance
  FROM public.client_balances
  WHERE client_id = p_sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender balance not found';
  END IF;

  v_available_balance := COALESCE(v_sender_balance.balance, 0) - COALESCE(v_sender_balance.reserved_balance, 0);
  IF v_available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_reserved_balance := COALESCE(v_sender_balance.reserved_balance, 0) + p_amount;

  UPDATE public.client_balances
  SET reserved_balance = v_reserved_balance, updated_at = v_now
  WHERE id = v_sender_balance.id;

  INSERT INTO public.wallet_transfers (
    sender_id,
    receiver_id,
    sender_name,
    sender_phone,
    receiver_name,
    receiver_phone,
    amount,
    currency,
    verification_code,
    status,
    notes,
    reserved_at,
    expires_at,
    origin_channel
  )
  VALUES (
    p_sender_id,
    p_receiver_id,
    p_sender_name,
    p_sender_phone,
    p_receiver_name,
    p_receiver_phone,
    p_amount,
    p_currency,
    p_verification_code,
    'pending',
    p_notes,
    v_now,
    v_now + INTERVAL '24 hours',
    p_origin_channel
  )
  RETURNING * INTO v_transfer;

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    reserved_amount,
    currency,
    available_balance_after,
    reserved_balance_after,
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    p_sender_id,
    p_sender_id,
    'client',
    'wallet_transfer_reserved',
    0,
    p_amount,
    p_currency,
    v_available_balance - p_amount,
    v_reserved_balance,
    'wallet_transfer',
    v_transfer.id,
    jsonb_build_object('origin_channel', p_origin_channel)
  );

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'available_balance', v_available_balance - p_amount,
    'reserved_balance', v_reserved_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.confirm_wallet_transfer_operation(
  p_transfer_id UUID,
  p_verification_code TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_skip_code_check BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
  v_transfer public.wallet_transfers%ROWTYPE;
  v_sender_balance public.client_balances%ROWTYPE;
  v_receiver_balance public.client_balances%ROWTYPE;
  v_sender_available_balance DECIMAL := 0;
  v_sender_reserved_balance DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_transfer
  FROM public.wallet_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer is not pending';
  END IF;

  SELECT *
  INTO v_sender_balance
  FROM public.client_balances
  WHERE client_id = v_transfer.sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender balance not found';
  END IF;

  IF v_transfer.expires_at IS NOT NULL AND v_transfer.expires_at < v_now THEN
    UPDATE public.client_balances
    SET reserved_balance = GREATEST(COALESCE(reserved_balance, 0) - v_transfer.amount, 0), updated_at = v_now
    WHERE id = v_sender_balance.id;

    UPDATE public.wallet_transfers
    SET status = 'expired', released_at = v_now
    WHERE id = v_transfer.id;

    RAISE EXCEPTION 'Transfer has expired';
  END IF;

  IF NOT p_skip_code_check AND COALESCE(v_transfer.verification_code, '') <> COALESCE(p_verification_code, '') THEN
    RAISE EXCEPTION 'Invalid verification code';
  END IF;

  IF COALESCE(v_sender_balance.reserved_balance, 0) < v_transfer.amount THEN
    RAISE EXCEPTION 'Reserved balance is insufficient';
  END IF;

  INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
  VALUES (v_transfer.receiver_id, 0, 0, v_transfer.currency)
  ON CONFLICT (client_id) DO NOTHING;

  SELECT *
  INTO v_receiver_balance
  FROM public.client_balances
  WHERE client_id = v_transfer.receiver_id
  FOR UPDATE;

  UPDATE public.client_balances
  SET
    balance = COALESCE(balance, 0) - v_transfer.amount,
    reserved_balance = GREATEST(COALESCE(reserved_balance, 0) - v_transfer.amount, 0),
    updated_at = v_now
  WHERE id = v_sender_balance.id;

  UPDATE public.client_balances
  SET
    balance = COALESCE(balance, 0) + v_transfer.amount,
    updated_at = v_now
  WHERE id = v_receiver_balance.id;

  UPDATE public.wallet_transfers
  SET status = 'confirmed', confirmed_at = v_now
  WHERE id = v_transfer.id
  RETURNING * INTO v_transfer;

  SELECT *
  INTO v_sender_balance
  FROM public.client_balances
  WHERE client_id = v_transfer.sender_id;

  v_sender_available_balance := COALESCE(v_sender_balance.balance, 0) - COALESCE(v_sender_balance.reserved_balance, 0);
  v_sender_reserved_balance := COALESCE(v_sender_balance.reserved_balance, 0);

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    reserved_amount,
    currency,
    available_balance_after,
    reserved_balance_after,
    reference_type,
    reference_id
  )
  VALUES
    (
      v_transfer.sender_id,
      COALESCE(p_actor_user_id, v_transfer.sender_id),
      'client',
      'wallet_transfer_debited',
      -v_transfer.amount,
      -v_transfer.amount,
      v_transfer.currency,
      v_sender_available_balance,
      v_sender_reserved_balance,
      'wallet_transfer',
      v_transfer.id
    ),
    (
      v_transfer.receiver_id,
      COALESCE(p_actor_user_id, v_transfer.receiver_id),
      'client',
      'wallet_transfer_received',
      v_transfer.amount,
      0,
      v_transfer.currency,
      COALESCE(v_receiver_balance.balance, 0) + v_transfer.amount,
      COALESCE(v_receiver_balance.reserved_balance, 0),
      'wallet_transfer',
      v_transfer.id
    );

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'sender_available_balance', v_sender_available_balance,
    'sender_reserved_balance', v_sender_reserved_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cancel_wallet_transfer_operation(
  p_transfer_id UUID,
  p_actor_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_transfer public.wallet_transfers%ROWTYPE;
  v_sender_balance public.client_balances%ROWTYPE;
  v_available_balance DECIMAL := 0;
  v_reserved_balance DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_transfer
  FROM public.wallet_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer cannot be cancelled';
  END IF;

  SELECT *
  INTO v_sender_balance
  FROM public.client_balances
  WHERE client_id = v_transfer.sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender balance not found';
  END IF;

  UPDATE public.client_balances
  SET
    reserved_balance = GREATEST(COALESCE(reserved_balance, 0) - v_transfer.amount, 0),
    updated_at = v_now
  WHERE id = v_sender_balance.id;

  UPDATE public.wallet_transfers
  SET status = 'cancelled', cancelled_at = v_now, released_at = v_now
  WHERE id = v_transfer.id
  RETURNING * INTO v_transfer;

  SELECT *
  INTO v_sender_balance
  FROM public.client_balances
  WHERE client_id = v_transfer.sender_id;

  v_available_balance := COALESCE(v_sender_balance.balance, 0) - COALESCE(v_sender_balance.reserved_balance, 0);
  v_reserved_balance := COALESCE(v_sender_balance.reserved_balance, 0);

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    reserved_amount,
    currency,
    available_balance_after,
    reserved_balance_after,
    reference_type,
    reference_id
  )
  VALUES (
    v_transfer.sender_id,
    p_actor_user_id,
    'client',
    'wallet_transfer_released',
    0,
    -v_transfer.amount,
    v_transfer.currency,
    v_available_balance,
    v_reserved_balance,
    'wallet_transfer',
    v_transfer.id
  );

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'available_balance', v_available_balance,
    'reserved_balance', v_reserved_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
