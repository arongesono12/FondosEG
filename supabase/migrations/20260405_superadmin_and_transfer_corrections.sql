BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
ADD CONSTRAINT users_role_check
CHECK (role IN ('admin', 'superadmin', 'gestor', 'cliente'));

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_user_id
      AND is_active = true
      AND role IN ('admin', 'superadmin')
  );
$$ LANGUAGE sql STABLE;

DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
CREATE POLICY "Admins can manage all users"
  ON public.users FOR ALL
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all balances" ON public.agent_balances;
CREATE POLICY "Admins can read all balances"
  ON public.agent_balances FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all balances" ON public.agent_balances;
CREATE POLICY "Admins can update all balances"
  ON public.agent_balances FOR ALL
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all client balances" ON public.client_balances;
CREATE POLICY "Admins can read all client balances"
  ON public.client_balances FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all client balances" ON public.client_balances;
CREATE POLICY "Admins can update all client balances"
  ON public.client_balances FOR ALL
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all transfers" ON public.transfers;
CREATE POLICY "Admins can read all transfers"
  ON public.transfers FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all transfers" ON public.transfers;
CREATE POLICY "Admins can manage all transfers"
  ON public.transfers FOR ALL
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all transactions" ON public.balance_transactions;
CREATE POLICY "Admins can read all transactions"
  ON public.balance_transactions FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all activity" ON public.activity_logs;
CREATE POLICY "Admins can read all activity"
  ON public.activity_logs FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.transfers t
      WHERE t.id = transfer_id AND t.agent_id = auth.uid()
    )
    OR public.is_admin_user(auth.uid())
  );

DROP POLICY IF EXISTS "Admins read all verifications" ON public.email_verification;
CREATE POLICY "Admins read all verifications"
  ON public.email_verification FOR ALL
  USING (public.is_admin_user(auth.uid()));

DO $$
DECLARE
  v_superadmin_email TEXT := 'arongesono@outlook.es';
  v_superadmin_password TEXT := 'FondosEG.SuperAdmin2026!';
  v_superadmin_name TEXT := 'Aron G Esono';
  v_superadmin_phone TEXT := '+240000000001';
  v_superadmin_id UUID;
BEGIN
  SELECT id INTO v_superadmin_id
  FROM auth.users
  WHERE email = v_superadmin_email
  LIMIT 1;

  IF v_superadmin_id IS NULL THEN
    v_superadmin_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      v_superadmin_id,
      '00000000-0000-0000-0000-000000000000',
      v_superadmin_email,
      crypt(v_superadmin_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'name', v_superadmin_name,
        'phone', v_superadmin_phone,
        'role', 'superadmin'
      ),
      now(),
      now(),
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'name', COALESCE(raw_user_meta_data->>'name', v_superadmin_name),
        'phone', COALESCE(raw_user_meta_data->>'phone', v_superadmin_phone),
        'role', 'superadmin'
      ),
      updated_at = now()
    WHERE id = v_superadmin_id;
  END IF;

  INSERT INTO public.users (
    id,
    name,
    email,
    phone,
    role,
    is_active,
    is_verified
  )
  VALUES (
    v_superadmin_id,
    v_superadmin_name,
    v_superadmin_email,
    v_superadmin_phone,
    'superadmin',
    true,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = 'superadmin',
    is_active = true,
    is_verified = true,
    updated_at = now();
END $$;

DROP FUNCTION IF EXISTS public.correct_agent_transfer_operation(
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
  DECIMAL,
  TEXT,
  TEXT,
  UUID
);

CREATE OR REPLACE FUNCTION public.correct_agent_transfer_operation(
  p_transfer_id UUID,
  p_actor_user_id UUID,
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
  v_transfer public.transfers%ROWTYPE;
  v_agent_balance public.agent_balances%ROWTYPE;
  v_old_receiver_balance public.client_balances%ROWTYPE;
  v_new_receiver_balance public.client_balances%ROWTYPE;
  v_previous_amount DECIMAL := 0;
  v_previous_receiver_user_id UUID := NULL;
  v_old_receiver_adjustment DECIMAL := 0;
  v_new_receiver_credit DECIMAL := 0;
  v_amount_delta DECIMAL := 0;
  v_new_agent_balance DECIMAL := 0;
  v_new_agent_cash DECIMAL := 0;
  v_old_receiver_new_balance DECIMAL := 0;
  v_new_receiver_new_balance DECIMAL := 0;
  v_same_receiver BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto invalido';
  END IF;

  SELECT *
  INTO v_transfer
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.transfer_type <> 'agent' THEN
    RAISE EXCEPTION 'Solo se pueden corregir envios realizados por gestores';
  END IF;

  v_previous_amount := COALESCE(v_transfer.amount, 0);
  v_previous_receiver_user_id := v_transfer.receiver_user_id;

  IF v_transfer.status NOT IN ('created', 'available_for_pickup') THEN
    RAISE EXCEPTION 'Solo se pueden corregir transferencias pendientes o disponibles para retiro';
  END IF;

  IF p_currency IS DISTINCT FROM v_transfer.currency THEN
    RAISE EXCEPTION 'No se puede cambiar la moneda de una transferencia existente';
  END IF;

  SELECT *
  INTO v_agent_balance
  FROM public.agent_balances
  WHERE agent_id = v_transfer.agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo del gestor no encontrado';
  END IF;

  v_amount_delta := p_amount - v_previous_amount;
  v_new_agent_balance := COALESCE(v_agent_balance.balance, 0) - v_amount_delta;
  v_new_agent_cash := COALESCE(v_agent_balance.cash_balance, 0) + v_amount_delta;

  IF v_amount_delta > 0 AND COALESCE(v_agent_balance.balance, 0) < v_amount_delta THEN
    RAISE EXCEPTION 'El gestor no tiene saldo suficiente para aumentar el importe del envio';
  END IF;

  IF v_new_agent_cash < 0 THEN
    RAISE EXCEPTION 'La correccion dejaria el saldo en efectivo del gestor por debajo de cero';
  END IF;

  v_same_receiver := COALESCE(v_transfer.receiver_user_id, '00000000-0000-0000-0000-000000000000'::UUID)
    = COALESCE(p_receiver_user_id, '00000000-0000-0000-0000-000000000000'::UUID);

  IF v_transfer.receiver_user_id IS NOT NULL
     AND v_transfer.wallet_credited_at IS NOT NULL
     AND v_transfer.wallet_debited_at IS NULL THEN
    SELECT *
    INTO v_old_receiver_balance
    FROM public.client_balances
    WHERE client_id = v_transfer.receiver_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saldo del cliente vinculado no encontrado';
    END IF;

    IF v_same_receiver THEN
      v_old_receiver_adjustment := GREATEST(v_previous_amount - p_amount, 0);
      IF v_old_receiver_adjustment > COALESCE(v_old_receiver_balance.balance, 0) THEN
        RAISE EXCEPTION 'No se puede reducir el importe porque el cliente ya utilizo el saldo acreditado';
      END IF;
    ELSE
      v_old_receiver_adjustment := v_previous_amount;
      IF v_old_receiver_adjustment > COALESCE(v_old_receiver_balance.balance, 0) THEN
        RAISE EXCEPTION 'No se puede reasignar el envio porque el cliente original ya utilizo el saldo acreditado';
      END IF;
    END IF;
  END IF;

  IF p_receiver_user_id IS NOT NULL THEN
    INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
    VALUES (p_receiver_user_id, 0, 0, p_currency)
    ON CONFLICT (client_id) DO NOTHING;

    SELECT *
    INTO v_new_receiver_balance
    FROM public.client_balances
    WHERE client_id = p_receiver_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saldo del cliente destino no encontrado';
    END IF;

    IF v_same_receiver THEN
      v_new_receiver_credit := GREATEST(p_amount - COALESCE(v_transfer.amount, 0), 0);
    ELSE
      v_new_receiver_credit := p_amount;
    END IF;
  END IF;

  UPDATE public.agent_balances
  SET
    balance = v_new_agent_balance,
    cash_balance = v_new_agent_cash,
    updated_at = v_now
  WHERE id = v_agent_balance.id;

  IF v_transfer.receiver_user_id IS NOT NULL
     AND v_transfer.wallet_credited_at IS NOT NULL
     AND v_transfer.wallet_debited_at IS NULL
     AND v_old_receiver_adjustment > 0 THEN
    v_old_receiver_new_balance := COALESCE(v_old_receiver_balance.balance, 0) - v_old_receiver_adjustment;

    UPDATE public.client_balances
    SET
      balance = v_old_receiver_new_balance,
      updated_at = v_now
    WHERE id = v_old_receiver_balance.id;
  ELSIF v_transfer.receiver_user_id IS NOT NULL
     AND v_transfer.wallet_credited_at IS NOT NULL
     AND v_transfer.wallet_debited_at IS NULL THEN
    v_old_receiver_new_balance := COALESCE(v_old_receiver_balance.balance, 0);
  END IF;

  IF p_receiver_user_id IS NOT NULL AND v_new_receiver_credit > 0 THEN
    v_new_receiver_new_balance := COALESCE(v_new_receiver_balance.balance, 0) + v_new_receiver_credit;

    UPDATE public.client_balances
    SET
      balance = v_new_receiver_new_balance,
      updated_at = v_now
    WHERE id = v_new_receiver_balance.id;
  ELSIF p_receiver_user_id IS NOT NULL THEN
    v_new_receiver_new_balance := COALESCE(v_new_receiver_balance.balance, 0);
  END IF;

  UPDATE public.transfers
  SET
    sender_name = p_sender_name,
    sender_phone = p_sender_phone,
    sender_document_type = p_sender_document_type,
    sender_document_number = p_sender_document_number,
    receiver_name = p_receiver_name,
    receiver_phone = p_receiver_phone,
    receiver_document_type = p_receiver_document_type,
    receiver_document_number = p_receiver_document_number,
    receiver_user_id = p_receiver_user_id,
    destination_city = p_destination_city,
    destination_country = p_destination_country,
    amount = p_amount,
    notes = p_notes,
    wallet_credited_at = CASE
      WHEN p_receiver_user_id IS NOT NULL THEN COALESCE(wallet_credited_at, v_now)
      ELSE NULL
    END
  WHERE id = p_transfer_id
  RETURNING * INTO v_transfer;

  IF v_amount_delta <> 0 THEN
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
      v_transfer.agent_id,
      CASE WHEN v_amount_delta > 0 THEN 'transfer' ELSE 'refund' END,
      CASE WHEN v_amount_delta > 0 THEN -v_amount_delta ELSE ABS(v_amount_delta) END,
      COALESCE(v_agent_balance.balance, 0),
      v_new_agent_balance,
      v_transfer.id,
      'transfer_correction',
      concat('Correccion administrativa del envio: ', v_transfer.transfer_code)
    );
  END IF;

  INSERT INTO public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'admin_correct_transfer',
    'transfer',
    v_transfer.id,
    jsonb_build_object(
      'transfer_code', v_transfer.transfer_code,
      'previous_amount', v_previous_amount,
      'new_amount', p_amount,
      'amount_delta', v_amount_delta,
      'previous_receiver_user_id', v_previous_receiver_user_id,
      'new_receiver_user_id', p_receiver_user_id,
      'new_destination_city', p_destination_city,
      'wallet_credit_adjusted', p_receiver_user_id IS NOT NULL OR v_transfer.receiver_user_id IS NOT NULL
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
    v_transfer.agent_id,
    p_actor_user_id,
    'agent',
      'agent_transfer_corrected',
      -v_amount_delta,
      v_transfer.currency,
      v_new_agent_balance,
      'transfer',
      v_transfer.id,
      jsonb_build_object(
        'transfer_code', v_transfer.transfer_code,
        'previous_amount', v_previous_amount,
        'new_amount', p_amount,
        'cash_balance_after', v_new_agent_cash
      )
  );

  IF v_transfer.receiver_user_id IS NOT NULL
     AND v_transfer.wallet_credited_at IS NOT NULL
     AND v_transfer.wallet_debited_at IS NULL
     AND v_old_receiver_adjustment > 0 THEN
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
      v_previous_receiver_user_id,
      p_actor_user_id,
      'client',
      'agent_transfer_correction_reversal',
      -v_old_receiver_adjustment,
      v_transfer.currency,
      v_old_receiver_new_balance,
      'transfer',
      v_transfer.id,
      jsonb_build_object('transfer_code', v_transfer.transfer_code)
    );
  END IF;

  IF p_receiver_user_id IS NOT NULL AND v_new_receiver_credit > 0 THEN
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
      'agent_transfer_correction_credit',
      v_new_receiver_credit,
      v_transfer.currency,
      v_new_receiver_new_balance,
      'transfer',
      v_transfer.id,
      jsonb_build_object('transfer_code', v_transfer.transfer_code)
    );
  END IF;

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'previous_amount', v_previous_amount,
    'new_amount', p_amount,
    'amount_delta', v_amount_delta,
    'agent_balance_after', v_new_agent_balance,
    'agent_cash_after', v_new_agent_cash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
