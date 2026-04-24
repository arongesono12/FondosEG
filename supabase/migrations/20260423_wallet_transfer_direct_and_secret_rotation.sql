BEGIN;

CREATE OR REPLACE FUNCTION public.create_wallet_transfer_direct_operation(
  p_sender_id UUID,
  p_receiver_phone TEXT,
  p_receiver_name TEXT,
  p_amount DECIMAL,
  p_currency TEXT DEFAULT 'XAF',
  p_notes TEXT DEFAULT NULL,
  p_origin_channel TEXT DEFAULT 'external_api'
)
RETURNS JSONB AS $$
DECLARE
  v_sender public.users%ROWTYPE;
  v_receiver public.users%ROWTYPE;
  v_sender_balance public.client_balances%ROWTYPE;
  v_receiver_balance public.client_balances%ROWTYPE;
  v_transfer public.wallet_transfers%ROWTYPE;
  v_sender_new_balance DECIMAL := 0;
  v_receiver_new_balance DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
  v_verification_code TEXT;
  v_notification_message TEXT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;

  SELECT *
  INTO v_sender
  FROM public.users
  WHERE id = p_sender_id;

  IF NOT FOUND OR v_sender.role <> 'cliente' THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  SELECT *
  INTO v_receiver
  FROM public.users
  WHERE phone = p_receiver_phone
    AND role = 'cliente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El receptor no es un cliente valido o no existe';
  END IF;

  IF v_receiver.id = p_sender_id THEN
    RAISE EXCEPTION 'No puedes transferirte a ti mismo';
  END IF;

  INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
  VALUES (p_sender_id, 0, 0, p_currency)
  ON CONFLICT (client_id) DO NOTHING;

  INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
  VALUES (v_receiver.id, 0, 0, p_currency)
  ON CONFLICT (client_id) DO NOTHING;

  SELECT *
  INTO v_sender_balance
  FROM public.client_balances
  WHERE client_id = p_sender_id
  FOR UPDATE;

  SELECT *
  INTO v_receiver_balance
  FROM public.client_balances
  WHERE client_id = v_receiver.id
  FOR UPDATE;

  IF COALESCE(v_sender_balance.balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_sender_new_balance := COALESCE(v_sender_balance.balance, 0) - p_amount;
  v_receiver_new_balance := COALESCE(v_receiver_balance.balance, 0) + p_amount;
  v_verification_code := LPAD((FLOOR(RANDOM() * 900000) + 100000)::TEXT, 6, '0');

  UPDATE public.client_balances
  SET
    balance = v_sender_new_balance,
    updated_at = v_now
  WHERE id = v_sender_balance.id;

  UPDATE public.client_balances
  SET
    balance = v_receiver_new_balance,
    updated_at = v_now
  WHERE id = v_receiver_balance.id;

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
    confirmed_at,
    origin_channel
  )
  VALUES (
    p_sender_id,
    v_receiver.id,
    v_sender.name,
    v_sender.phone,
    p_receiver_name,
    p_receiver_phone,
    p_amount,
    p_currency,
    v_verification_code,
    'confirmed',
    p_notes,
    v_now,
    p_origin_channel
  )
  RETURNING * INTO v_transfer;

  v_notification_message := FORMAT('Tienes una transferencia de %s %s de %s.', p_amount, p_currency, v_sender.name);

  INSERT INTO public.notifications (
    user_id,
    phone,
    message,
    status,
    is_admin_notification,
    priority
  )
  VALUES (
    v_receiver.id,
    p_receiver_phone,
    v_notification_message,
    'pending',
    FALSE,
    'high'
  );

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
  VALUES
    (
      p_sender_id,
      p_sender_id,
      'client',
      'wallet_transfer_debited',
      -p_amount,
      0,
      p_currency,
      v_sender_new_balance,
      COALESCE(v_sender_balance.reserved_balance, 0),
      'wallet_transfer',
      v_transfer.id,
      jsonb_build_object('origin_channel', p_origin_channel)
    ),
    (
      v_receiver.id,
      p_sender_id,
      'client',
      'wallet_transfer_received',
      p_amount,
      0,
      p_currency,
      v_receiver_new_balance,
      COALESCE(v_receiver_balance.reserved_balance, 0),
      'wallet_transfer',
      v_transfer.id,
      jsonb_build_object('origin_channel', p_origin_channel)
    );

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'new_balance', v_sender_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.rotate_api_secret_operation(
  p_api_key_id UUID,
  p_user_id UUID,
  p_api_secret_hash TEXT,
  p_api_secret_preview TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated_rows INTEGER := 0;
BEGIN
  UPDATE public.api_keys
  SET
    api_secret = p_api_secret_hash,
    api_secret_hash = p_api_secret_hash,
    api_secret_preview = p_api_secret_preview,
    updated_at = NOW()
  WHERE id = p_api_key_id
    AND user_id = p_user_id
    AND is_active = TRUE;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  RETURN v_updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
