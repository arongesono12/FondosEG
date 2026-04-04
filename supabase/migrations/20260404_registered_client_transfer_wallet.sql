BEGIN;

ALTER TABLE public.transfers
ADD COLUMN IF NOT EXISTS receiver_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS wallet_credited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS wallet_debited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_transfers_receiver_user_id
  ON public.transfers(receiver_user_id);

DROP FUNCTION IF EXISTS public.create_agent_transfer_operation(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DECIMAL,
  TEXT,
  TEXT
);

CREATE OR REPLACE FUNCTION public.create_agent_transfer_operation(
  p_agent_id UUID,
  p_actor_user_id UUID,
  p_transfer_code TEXT,
  p_sender_name TEXT,
  p_sender_phone TEXT,
  p_sender_document_type TEXT,
  p_sender_document_number TEXT,
  p_receiver_name TEXT,
  p_receiver_phone TEXT,
  p_receiver_document_type TEXT,
  p_receiver_document_number TEXT,
  p_destination_city TEXT,
  p_destination_country TEXT,
  p_amount DECIMAL,
  p_currency TEXT,
  p_notes TEXT,
  p_receiver_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_previous_balance DECIMAL := 0;
  v_new_balance DECIMAL := 0;
  v_previous_cash DECIMAL := 0;
  v_new_cash DECIMAL := 0;
  v_transfer public.transfers%ROWTYPE;
  v_commission DECIMAL := 0;
  v_rule_code TEXT;
  v_receiver_balance public.client_balances%ROWTYPE;
  v_receiver_new_balance DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto invalido';
  END IF;

  INSERT INTO public.agent_balances (agent_id, balance, cash_balance, currency)
  VALUES (p_agent_id, 0, 0, p_currency)
  ON CONFLICT (agent_id) DO NOTHING;

  SELECT * INTO v_transfer FROM public.transfers WHERE transfer_code = p_transfer_code LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Transfer code already exists';
  END IF;

  SELECT balance, cash_balance
  INTO v_previous_balance, v_previous_cash
  FROM public.agent_balances
  WHERE agent_id = p_agent_id
  FOR UPDATE;

  IF v_previous_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente para realizar la transferencia';
  END IF;

  v_commission := public.calculate_tariff_commission(p_amount);
  v_rule_code := public.calculate_tariff_rule_code(p_amount);

  v_new_balance := v_previous_balance - p_amount;
  v_new_cash := v_previous_cash + p_amount;

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
    receiver_user_id,
    destination_city,
    destination_country,
    amount,
    currency,
    status,
    notes,
    available_at,
    commission_amount,
    pricing_rule_code,
    wallet_credited_at
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
    p_receiver_user_id,
    p_destination_city,
    p_destination_country,
    p_amount,
    p_currency,
    'available_for_pickup',
    p_notes,
    v_now,
    v_commission,
    v_rule_code,
    CASE WHEN p_receiver_user_id IS NOT NULL THEN v_now ELSE NULL END
  )
  RETURNING * INTO v_transfer;

  UPDATE public.agent_balances
  SET balance = v_new_balance, cash_balance = v_new_cash, updated_at = v_now
  WHERE agent_id = p_agent_id;

  IF p_receiver_user_id IS NOT NULL THEN
    INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
    VALUES (p_receiver_user_id, 0, 0, p_currency)
    ON CONFLICT (client_id) DO NOTHING;

    SELECT *
    INTO v_receiver_balance
    FROM public.client_balances
    WHERE client_id = p_receiver_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saldo del cliente no encontrado';
    END IF;

    v_receiver_new_balance := COALESCE(v_receiver_balance.balance, 0) + p_amount;

    UPDATE public.client_balances
    SET balance = v_receiver_new_balance, updated_at = v_now
    WHERE id = v_receiver_balance.id;
  END IF;

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
    concat('Transferencia enviada: ', p_transfer_code)
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
      'pricing_rule_code', v_rule_code,
      'cash_delta', p_amount,
      'receiver_user_id', p_receiver_user_id,
      'wallet_credited', p_receiver_user_id IS NOT NULL
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
    jsonb_build_object(
      'transfer_code', p_transfer_code,
      'commission_amount', v_commission,
      'pricing_rule_code', v_rule_code,
      'cash_balance_after', v_new_cash
    )
  );

  IF p_receiver_user_id IS NOT NULL THEN
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
      p_receiver_user_id,
      p_actor_user_id,
      'client',
      'agent_transfer_wallet_credit',
      p_amount,
      p_currency,
      v_receiver_new_balance,
      'transfer',
      v_transfer.id,
      jsonb_build_object('transfer_code', p_transfer_code)
    );
  END IF;

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'previous_balance', v_previous_balance,
    'new_balance', v_new_balance,
    'previous_cash', v_previous_cash,
    'new_cash', v_new_cash,
    'commission_amount', v_commission,
    'pricing_rule_code', v_rule_code,
    'wallet_credited', p_receiver_user_id IS NOT NULL
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
  v_payer_balance public.agent_balances%ROWTYPE;
  v_receiver_balance public.client_balances%ROWTYPE;
  v_prev_balance DECIMAL := 0;
  v_prev_cash DECIMAL := 0;
  v_new_balance DECIMAL := 0;
  v_new_cash DECIMAL := 0;
  v_receiver_available DECIMAL := 0;
  v_receiver_new_balance DECIMAL := 0;
  v_wallet_debited BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_transfer
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status NOT IN ('created', 'available_for_pickup') THEN
    RAISE EXCEPTION 'La transferencia no esta lista para pago';
  END IF;

  SELECT * INTO v_payer_balance
  FROM public.agent_balances
  WHERE agent_id = p_actor_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo del gestor pagador no encontrado';
  END IF;

  v_prev_balance := COALESCE(v_payer_balance.balance, 0);
  v_prev_cash := COALESCE(v_payer_balance.cash_balance, 0);

  IF v_prev_cash < v_transfer.amount THEN
    RAISE EXCEPTION 'Saldo en efectivo insuficiente para pagar esta transferencia';
  END IF;

  IF v_transfer.receiver_user_id IS NOT NULL
     AND v_transfer.wallet_credited_at IS NOT NULL
     AND v_transfer.wallet_debited_at IS NULL THEN
    SELECT *
    INTO v_receiver_balance
    FROM public.client_balances
    WHERE client_id = v_transfer.receiver_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saldo del cliente no encontrado';
    END IF;

    v_receiver_available := COALESCE(v_receiver_balance.balance, 0) - COALESCE(v_receiver_balance.reserved_balance, 0);
    IF v_receiver_available < v_transfer.amount THEN
      RAISE EXCEPTION 'El cliente no tiene saldo disponible suficiente en billetera para retirar este envio en efectivo';
    END IF;

    v_receiver_new_balance := COALESCE(v_receiver_balance.balance, 0) - v_transfer.amount;

    UPDATE public.client_balances
    SET balance = v_receiver_new_balance, updated_at = v_now
    WHERE id = v_receiver_balance.id;

    v_wallet_debited := TRUE;
  END IF;

  v_new_balance := v_prev_balance + v_transfer.amount;
  v_new_cash := v_prev_cash - v_transfer.amount;

  UPDATE public.transfers
  SET
    status = 'paid_out',
    completed_at = v_now,
    paid_out_at = v_now,
    paid_out_by = p_actor_user_id,
    wallet_debited_at = CASE WHEN v_wallet_debited THEN v_now ELSE wallet_debited_at END
  WHERE id = p_transfer_id
  RETURNING * INTO v_transfer;

  UPDATE public.agent_balances
  SET balance = v_new_balance, cash_balance = v_new_cash, updated_at = v_now
  WHERE agent_id = p_actor_user_id;

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
    p_actor_user_id,
    'transfer',
    v_transfer.amount,
    v_prev_balance,
    v_new_balance,
    v_transfer.id,
    'transfer',
    concat('Pago de transferencia: ', v_transfer.transfer_code)
  );

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_actor_user_id,
    'pay_out_transfer',
    'transfer',
    v_transfer.id,
    jsonb_build_object(
      'transfer_code', v_transfer.transfer_code,
      'amount', v_transfer.amount,
      'cash_delta', -v_transfer.amount,
      'wallet_debited', v_wallet_debited
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
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    p_actor_user_id,
    p_actor_user_id,
    'agent',
    'transfer_paid_out',
    v_transfer.amount,
    v_transfer.currency,
    'transfer',
    v_transfer.id,
    jsonb_build_object(
      'transfer_code', v_transfer.transfer_code,
      'cash_balance_after', v_new_cash
    )
  );

  IF v_wallet_debited THEN
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
      v_transfer.receiver_user_id,
      p_actor_user_id,
      'client',
      'agent_transfer_cash_withdrawal',
      -v_transfer.amount,
      v_transfer.currency,
      v_receiver_new_balance,
      'transfer',
      v_transfer.id,
      jsonb_build_object('transfer_code', v_transfer.transfer_code)
    );
  END IF;

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'previous_balance', v_prev_balance,
    'new_balance', v_new_balance,
    'previous_cash', v_prev_cash,
    'new_cash', v_new_cash,
    'wallet_debited', v_wallet_debited
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
