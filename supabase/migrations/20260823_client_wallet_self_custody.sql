-- ============================================================================
-- Autocustodia del saldo del cliente registrado
-- ============================================================================
--
-- CONTEXTO
--
-- Hasta ahora, cuando un gestor enviaba dinero a un teléfono que pertenecía a
-- un cliente registrado ocurrían DOS cosas a la vez:
--
--   1. Se abonaba el importe en `client_balances` (la billetera del cliente).
--   2. El envío quedaba `available_for_pickup` con un `transfer_code` vivo, y
--      `pay_out_agent_transfer_operation` DEBITABA esa misma billetera cuando
--      alguien presentaba el código en ventanilla.
--
-- Es decir: el saldo del cliente estaba condicionado a un vale al portador que
-- ni siquiera custodiaba él. El código viaja por SMS también al EMISOR, así que
-- quien envió el dinero podía ir a un gestor y retirarlo de la billetera del
-- beneficiario. Y al revés: si el cliente gastaba su propio saldo desde el
-- panel, el pago en ventanilla fallaba con "el cliente no tiene saldo
-- disponible" y el gestor se quedaba sin poder cerrar la operación.
--
-- REGLA NUEVA
--
--   * Beneficiario CON cuenta en la aplicación -> el envío se LIQUIDA contra su
--     billetera en el mismo momento (`completed`). No hay código de retiro
--     utilizable: el dinero es suyo y lo gestiona desde su panel. Si quiere
--     efectivo, genera ÉL su propio código de retiro (`client_withdrawals`) y
--     lo presenta en cualquier gestor.
--   * Beneficiario SIN cuenta -> flujo de ventanilla de siempre: código
--     generado por el gestor emisor y pago con
--     `pay_out_agent_transfer_operation`.
--
-- El sistema decide solo: `findRegisteredClientByPhone` resuelve el teléfono
-- contra `users` antes de crear el envío y pasa `p_receiver_user_id`.
--
-- CONTABILIDAD DE RED
--
-- El circuito de float no cambia. El gestor emisor sigue convirtiendo float en
-- efectivo al recibir el dinero (`balance -1`, `cash_balance +1`) y el gestor
-- pagador sigue convirtiendo efectivo en float al entregarlo (`cash_balance -1`,
-- `balance +1`). Lo único que cambia es QUÉ documento autoriza esa entrega:
-- antes el envío del gestor, ahora el retiro emitido por el propio cliente.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Retiros de efectivo iniciados por el cliente
-- ---------------------------------------------------------------------------
--
-- Un retiro es un vale al portador emitido por el titular del saldo. Mientras
-- vive, el importe queda RETENIDO (`reserved_balance`) para que no se pueda
-- comprometer dos veces: ni por otra orden de billetera ni por un segundo
-- código de retiro.

CREATE TABLE IF NOT EXISTS public.client_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  withdrawal_code TEXT NOT NULL UNIQUE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid_out', 'cancelled', 'expired')),
  destination_city TEXT,
  notes TEXT,
  reserved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  paid_out_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_withdrawals_client_status
  ON public.client_withdrawals(client_id, status);

CREATE INDEX IF NOT EXISTS idx_client_withdrawals_code
  ON public.client_withdrawals(withdrawal_code);

CREATE INDEX IF NOT EXISTS idx_client_withdrawals_status_expires
  ON public.client_withdrawals(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_client_withdrawals_paid_out_by
  ON public.client_withdrawals(paid_out_by);

-- RLS activo y SIN políticas: tras la migración a Clerk, `auth.uid()` es NULL
-- para `anon`/`authenticated`, así que cualquier política escrita contra él
-- denegaría igualmente. Todo el acceso pasa por el service role desde
-- `app/api/withdrawals/**`, que comprueba rol y titularidad antes de operar.
ALTER TABLE public.client_withdrawals ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Emisión del código de retiro (retiene fondos)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_client_withdrawal_operation(
  p_client_id UUID,
  p_withdrawal_code TEXT,
  p_amount DECIMAL,
  p_currency TEXT DEFAULT 'XAF',
  p_destination_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_expires_in_hours INTEGER DEFAULT 72
)
RETURNS JSONB AS $$
DECLARE
  v_balance public.client_balances%ROWTYPE;
  v_withdrawal public.client_withdrawals%ROWTYPE;
  v_available DECIMAL := 0;
  v_reserved DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
  VALUES (p_client_id, 0, 0, p_currency)
  ON CONFLICT (client_id) DO NOTHING;

  SELECT *
  INTO v_balance
  FROM public.client_balances
  WHERE client_id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client balance not found';
  END IF;

  IF COALESCE(v_balance.currency, p_currency) IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'Currency mismatch';
  END IF;

  -- Saldo DISPONIBLE, no bruto: lo ya retenido por otro código vivo o por una
  -- orden de billetera pendiente no se puede volver a comprometer.
  v_available := COALESCE(v_balance.balance, 0) - COALESCE(v_balance.reserved_balance, 0);
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_reserved := COALESCE(v_balance.reserved_balance, 0) + p_amount;

  UPDATE public.client_balances
  SET reserved_balance = v_reserved, updated_at = v_now
  WHERE id = v_balance.id;

  INSERT INTO public.client_withdrawals (
    client_id,
    withdrawal_code,
    amount,
    currency,
    status,
    destination_city,
    notes,
    reserved_at,
    expires_at
  )
  VALUES (
    p_client_id,
    p_withdrawal_code,
    p_amount,
    p_currency,
    'pending',
    p_destination_city,
    p_notes,
    v_now,
    v_now + make_interval(hours => GREATEST(COALESCE(p_expires_in_hours, 72), 1))
  )
  RETURNING * INTO v_withdrawal;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_client_id,
    'create_client_withdrawal',
    'client_withdrawal',
    v_withdrawal.id,
    jsonb_build_object(
      'withdrawal_code', p_withdrawal_code,
      'amount', p_amount,
      'currency', p_currency,
      'expires_at', v_withdrawal.expires_at
    ),
    v_now
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
  VALUES (
    p_client_id,
    p_client_id,
    'client',
    'client_withdrawal_reserved',
    0,
    p_amount,
    p_currency,
    v_available - p_amount,
    v_reserved,
    'client_withdrawal',
    v_withdrawal.id,
    jsonb_build_object('withdrawal_code', p_withdrawal_code)
  );

  RETURN jsonb_build_object(
    'withdrawal', to_jsonb(v_withdrawal),
    'available_balance', v_available - p_amount,
    'reserved_balance', v_reserved
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Pago del retiro en ventanilla
-- ---------------------------------------------------------------------------
--
-- El gestor entrega efectivo y recibe float, exactamente igual que al pagar un
-- envío de ventanilla. La diferencia es que el débito de la billetera consume
-- la retención emitida por el propio cliente, no una acreditación ajena.
--
-- `p_agent_id` NO autoriza nada aquí: la ruta ya ha comprobado que quien llama
-- es un gestor. Esta función sólo garantiza que el dinero se mueve entero o no
-- se mueve.

CREATE OR REPLACE FUNCTION public.pay_out_client_withdrawal_operation(
  p_withdrawal_id UUID,
  p_agent_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_withdrawal public.client_withdrawals%ROWTYPE;
  v_client_balance public.client_balances%ROWTYPE;
  v_agent_balance public.agent_balances%ROWTYPE;
  v_client_new_balance DECIMAL := 0;
  v_client_new_reserved DECIMAL := 0;
  v_prev_agent_balance DECIMAL := 0;
  v_prev_agent_cash DECIMAL := 0;
  v_new_agent_balance DECIMAL := 0;
  v_new_agent_cash DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_withdrawal
  FROM public.client_withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  IF v_withdrawal.status <> 'pending' THEN
    RAISE EXCEPTION 'Withdrawal is not pending';
  END IF;

  -- ORDEN DE BLOQUEO: agent_balances ANTES que client_balances, el mismo que
  -- siguen `pay_out_agent_transfer_operation` y `correct_agent_transfer_operation`.
  -- Invertirlo aquí abriría un interbloqueo entre una corrección administrativa
  -- y el pago de un retiro que tocasen a las mismas dos partes.
  INSERT INTO public.agent_balances (agent_id, balance, cash_balance, currency)
  VALUES (p_agent_id, 0, 0, v_withdrawal.currency)
  ON CONFLICT (agent_id) DO NOTHING;

  SELECT *
  INTO v_agent_balance
  FROM public.agent_balances
  WHERE agent_id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo del gestor pagador no encontrado';
  END IF;

  SELECT *
  INTO v_client_balance
  FROM public.client_balances
  WHERE client_id = v_withdrawal.client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client balance not found';
  END IF;

  -- Caducado: se aborta sin tocar nada.
  --
  -- Deliberadamente NO se libera la retención aquí. `RAISE EXCEPTION` deshace
  -- la transacción completa, así que cualquier UPDATE escrito justo antes se
  -- perdería y sólo daría la falsa impresión de haber liberado el importe.
  -- Quien libera de verdad es `release_expired_client_withdrawals`, que no
  -- lanza y por eso sí confirma su trabajo; se invoca al listar los retiros del
  -- cliente, al resolver un código en ventanilla y tras este error.
  IF v_withdrawal.expires_at IS NOT NULL AND v_withdrawal.expires_at < v_now THEN
    RAISE EXCEPTION 'Withdrawal has expired';
  END IF;

  IF COALESCE(v_client_balance.reserved_balance, 0) < v_withdrawal.amount THEN
    RAISE EXCEPTION 'Reserved balance is insufficient';
  END IF;

  IF COALESCE(v_client_balance.balance, 0) < v_withdrawal.amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_prev_agent_balance := COALESCE(v_agent_balance.balance, 0);
  v_prev_agent_cash := COALESCE(v_agent_balance.cash_balance, 0);

  IF v_prev_agent_cash < v_withdrawal.amount THEN
    RAISE EXCEPTION 'Saldo en efectivo insuficiente para pagar este retiro';
  END IF;

  v_client_new_balance := COALESCE(v_client_balance.balance, 0) - v_withdrawal.amount;
  v_client_new_reserved := GREATEST(COALESCE(v_client_balance.reserved_balance, 0) - v_withdrawal.amount, 0);

  UPDATE public.client_balances
  SET
    balance = v_client_new_balance,
    reserved_balance = v_client_new_reserved,
    updated_at = v_now
  WHERE id = v_client_balance.id;

  v_new_agent_balance := v_prev_agent_balance + v_withdrawal.amount;
  v_new_agent_cash := v_prev_agent_cash - v_withdrawal.amount;

  UPDATE public.agent_balances
  SET balance = v_new_agent_balance, cash_balance = v_new_agent_cash, updated_at = v_now
  WHERE id = v_agent_balance.id;

  UPDATE public.client_withdrawals
  SET
    status = 'paid_out',
    paid_out_at = v_now,
    paid_out_by = p_agent_id,
    released_at = v_now,
    updated_at = v_now
  WHERE id = v_withdrawal.id
  RETURNING * INTO v_withdrawal;

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
    v_withdrawal.amount,
    v_prev_agent_balance,
    v_new_agent_balance,
    v_withdrawal.id,
    'client_withdrawal',
    concat('Pago de retiro de billetera: ', v_withdrawal.withdrawal_code)
  );

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_agent_id,
    'pay_out_client_withdrawal',
    'client_withdrawal',
    v_withdrawal.id,
    jsonb_build_object(
      'withdrawal_code', v_withdrawal.withdrawal_code,
      'amount', v_withdrawal.amount,
      'client_id', v_withdrawal.client_id,
      'cash_delta', -v_withdrawal.amount
    ),
    v_now
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
      v_withdrawal.client_id,
      p_agent_id,
      'client',
      'client_withdrawal_paid_out',
      -v_withdrawal.amount,
      -v_withdrawal.amount,
      v_withdrawal.currency,
      v_client_new_balance - v_client_new_reserved,
      v_client_new_reserved,
      'client_withdrawal',
      v_withdrawal.id,
      jsonb_build_object('withdrawal_code', v_withdrawal.withdrawal_code, 'agent_id', p_agent_id)
    ),
    (
      p_agent_id,
      p_agent_id,
      'agent',
      'client_withdrawal_cash_paid',
      v_withdrawal.amount,
      0,
      v_withdrawal.currency,
      v_new_agent_balance,
      0,
      'client_withdrawal',
      v_withdrawal.id,
      jsonb_build_object(
        'withdrawal_code', v_withdrawal.withdrawal_code,
        'cash_balance_after', v_new_agent_cash
      )
    );

  RETURN jsonb_build_object(
    'withdrawal', to_jsonb(v_withdrawal),
    'client_balance', v_client_new_balance,
    'client_reserved_balance', v_client_new_reserved,
    'agent_previous_balance', v_prev_agent_balance,
    'agent_new_balance', v_new_agent_balance,
    'agent_previous_cash', v_prev_agent_cash,
    'agent_new_cash', v_new_agent_cash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 4. Anulación del retiro (libera la retención)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_client_withdrawal_operation(
  p_withdrawal_id UUID,
  p_actor_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_withdrawal public.client_withdrawals%ROWTYPE;
  v_balance public.client_balances%ROWTYPE;
  v_reserved DECIMAL := 0;
  v_available DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_withdrawal
  FROM public.client_withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  IF v_withdrawal.status <> 'pending' THEN
    RAISE EXCEPTION 'Withdrawal cannot be cancelled';
  END IF;

  SELECT *
  INTO v_balance
  FROM public.client_balances
  WHERE client_id = v_withdrawal.client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client balance not found';
  END IF;

  v_reserved := GREATEST(COALESCE(v_balance.reserved_balance, 0) - v_withdrawal.amount, 0);
  v_available := COALESCE(v_balance.balance, 0) - v_reserved;

  UPDATE public.client_balances
  SET reserved_balance = v_reserved, updated_at = v_now
  WHERE id = v_balance.id;

  UPDATE public.client_withdrawals
  SET status = 'cancelled', cancelled_at = v_now, released_at = v_now, updated_at = v_now
  WHERE id = v_withdrawal.id
  RETURNING * INTO v_withdrawal;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_actor_user_id,
    'cancel_client_withdrawal',
    'client_withdrawal',
    v_withdrawal.id,
    jsonb_build_object(
      'withdrawal_code', v_withdrawal.withdrawal_code,
      'amount', v_withdrawal.amount
    ),
    v_now
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
  VALUES (
    v_withdrawal.client_id,
    p_actor_user_id,
    'client',
    'client_withdrawal_released',
    0,
    -v_withdrawal.amount,
    v_withdrawal.currency,
    v_available,
    v_reserved,
    'client_withdrawal',
    v_withdrawal.id,
    jsonb_build_object('withdrawal_code', v_withdrawal.withdrawal_code)
  );

  RETURN jsonb_build_object(
    'withdrawal', to_jsonb(v_withdrawal),
    'available_balance', v_available,
    'reserved_balance', v_reserved
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 5. Barrido de retiros caducados
-- ---------------------------------------------------------------------------
--
-- Sin esto, un código que nadie presenta dejaría el importe retenido para
-- siempre. Se invoca al listar los retiros del cliente, de modo que el saldo
-- disponible que ve en pantalla ya está saneado.

CREATE OR REPLACE FUNCTION public.release_expired_client_withdrawals(
  p_client_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_withdrawal public.client_withdrawals%ROWTYPE;
  v_balance public.client_balances%ROWTYPE;
  v_reserved DECIMAL := 0;
  v_released INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  FOR v_withdrawal IN
    SELECT *
    FROM public.client_withdrawals
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < v_now
      AND (p_client_id IS NULL OR client_id = p_client_id)
    ORDER BY created_at
    FOR UPDATE
  LOOP
    SELECT *
    INTO v_balance
    FROM public.client_balances
    WHERE client_id = v_withdrawal.client_id
    FOR UPDATE;

    IF FOUND THEN
      v_reserved := GREATEST(COALESCE(v_balance.reserved_balance, 0) - v_withdrawal.amount, 0);

      UPDATE public.client_balances
      SET reserved_balance = v_reserved, updated_at = v_now
      WHERE id = v_balance.id;

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
        v_withdrawal.client_id,
        v_withdrawal.client_id,
        'client',
        'client_withdrawal_expired',
        0,
        -v_withdrawal.amount,
        v_withdrawal.currency,
        COALESCE(v_balance.balance, 0) - v_reserved,
        v_reserved,
        'client_withdrawal',
        v_withdrawal.id,
        jsonb_build_object('withdrawal_code', v_withdrawal.withdrawal_code)
      );
    END IF;

    UPDATE public.client_withdrawals
    SET status = 'expired', released_at = v_now, updated_at = v_now
    WHERE id = v_withdrawal.id;

    v_released := v_released + 1;
  END LOOP;

  RETURN v_released;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 6. Creación de envío de gestor: liquidación inmediata si hay cuenta
-- ---------------------------------------------------------------------------
--
-- Único cambio funcional respecto a `20260404_registered_client_transfer_wallet.sql`:
-- cuando el beneficiario está vinculado a una cuenta, el envío nace `completed`
-- con `completed_at`, en lugar de quedarse `available_for_pickup` esperando un
-- código que ahora ya no debe poder cobrarse en ventanilla.

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
  v_wallet_settled BOOLEAN := p_receiver_user_id IS NOT NULL;
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
    wallet_credited_at,
    completed_at
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
    -- Con cuenta vinculada el envío queda LIQUIDADO: el dinero ya está en la
    -- billetera del beneficiario y no hay nada que cobrar en ventanilla.
    CASE WHEN v_wallet_settled THEN 'completed' ELSE 'available_for_pickup' END,
    p_notes,
    v_now,
    v_commission,
    v_rule_code,
    CASE WHEN v_wallet_settled THEN v_now ELSE NULL END,
    CASE WHEN v_wallet_settled THEN v_now ELSE NULL END
  )
  RETURNING * INTO v_transfer;

  UPDATE public.agent_balances
  SET balance = v_new_balance, cash_balance = v_new_cash, updated_at = v_now
  WHERE agent_id = p_agent_id;

  IF v_wallet_settled THEN
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
      'status', v_transfer.status,
      'commission_amount', v_commission,
      'pricing_rule_code', v_rule_code,
      'cash_delta', p_amount,
      'receiver_user_id', p_receiver_user_id,
      'wallet_credited', v_wallet_settled,
      'wallet_settled', v_wallet_settled
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
      'cash_balance_after', v_new_cash,
      'wallet_settled', v_wallet_settled
    )
  );

  IF v_wallet_settled THEN
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
      v_receiver_new_balance - COALESCE(v_receiver_balance.reserved_balance, 0),
      'transfer',
      v_transfer.id,
      jsonb_build_object('transfer_code', p_transfer_code, 'wallet_settled', TRUE)
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
    'wallet_credited', v_wallet_settled,
    'wallet_settled', v_wallet_settled
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 7. Pago en ventanilla: sólo para beneficiarios sin cuenta
-- ---------------------------------------------------------------------------
--
-- Desaparece el débito de la billetera del beneficiario. Un envío acreditado a
-- una cuenta ya está liquidado; cobrarlo otra vez con el código sería pagar dos
-- veces el mismo dinero, y permitiría al emisor (que también recibe el código
-- por SMS) vaciar la billetera del destinatario.

CREATE OR REPLACE FUNCTION public.pay_out_agent_transfer_operation(
  p_transfer_id UUID,
  p_actor_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_transfer public.transfers%ROWTYPE;
  v_payer_balance public.agent_balances%ROWTYPE;
  v_prev_balance DECIMAL := 0;
  v_prev_cash DECIMAL := 0;
  v_new_balance DECIMAL := 0;
  v_new_cash DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_transfer
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  -- Se comprueba ANTES que el estado para poder decir por qué: el gestor
  -- necesita saber que el beneficiario debe emitir su propio código, no que
  -- "la transferencia no está lista".
  IF v_transfer.receiver_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Transfer settled to wallet';
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

  v_new_balance := v_prev_balance + v_transfer.amount;
  v_new_cash := v_prev_cash - v_transfer.amount;

  UPDATE public.transfers
  SET
    status = 'paid_out',
    completed_at = v_now,
    paid_out_at = v_now,
    paid_out_by = p_actor_user_id
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
      'wallet_debited', FALSE
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

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'previous_balance', v_prev_balance,
    'new_balance', v_new_balance,
    'previous_cash', v_prev_cash,
    'new_cash', v_new_cash,
    'wallet_debited', FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 8. Corrección administrativa sobre envíos ya liquidados en billetera
-- ---------------------------------------------------------------------------
--
-- Los envíos a clientes registrados nacen `completed`. Sin este cambio, la
-- corrección administrativa dejaría de funcionar para todos ellos, porque sólo
-- aceptaba `created` / `available_for_pickup`.
--
-- Se admite `completed` únicamente cuando la liquidación fue a billetera y el
-- importe sigue ahí (`wallet_debited_at IS NULL`); un envío pagado en efectivo
-- sigue siendo incorregible. Además, la reversión respeta el saldo DISPONIBLE:
-- si el cliente ya ha retenido ese dinero para un retiro, no se le puede quitar.

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
  v_old_receiver_available DECIMAL := 0;
  v_new_receiver_credit DECIMAL := 0;
  v_amount_delta DECIMAL := 0;
  v_new_agent_balance DECIMAL := 0;
  v_new_agent_cash DECIMAL := 0;
  v_old_receiver_new_balance DECIMAL := 0;
  v_new_receiver_new_balance DECIMAL := 0;
  v_same_receiver BOOLEAN := FALSE;
  v_old_wallet_credited BOOLEAN := FALSE;
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
  v_old_wallet_credited := v_transfer.receiver_user_id IS NOT NULL
    AND v_transfer.wallet_credited_at IS NOT NULL
    AND v_transfer.wallet_debited_at IS NULL;

  IF v_transfer.status NOT IN ('created', 'available_for_pickup')
     AND NOT (v_transfer.status = 'completed' AND v_old_wallet_credited) THEN
    RAISE EXCEPTION 'Solo se pueden corregir transferencias pendientes, disponibles para retiro o liquidadas en billetera';
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

  IF v_old_wallet_credited THEN
    SELECT *
    INTO v_old_receiver_balance
    FROM public.client_balances
    WHERE client_id = v_transfer.receiver_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saldo del cliente vinculado no encontrado';
    END IF;

    -- Sólo se puede recuperar lo que el cliente no ha gastado NI retenido para
    -- un retiro en curso.
    v_old_receiver_available := COALESCE(v_old_receiver_balance.balance, 0)
      - COALESCE(v_old_receiver_balance.reserved_balance, 0);

    IF v_same_receiver THEN
      v_old_receiver_adjustment := GREATEST(v_previous_amount - p_amount, 0);
      IF v_old_receiver_adjustment > v_old_receiver_available THEN
        RAISE EXCEPTION 'No se puede reducir el importe porque el cliente ya utilizo o reservo el saldo acreditado';
      END IF;
    ELSE
      v_old_receiver_adjustment := v_previous_amount;
      IF v_old_receiver_adjustment > v_old_receiver_available THEN
        RAISE EXCEPTION 'No se puede reasignar el envio porque el cliente original ya utilizo o reservo el saldo acreditado';
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

  IF v_old_wallet_credited AND v_old_receiver_adjustment > 0 THEN
    v_old_receiver_new_balance := COALESCE(v_old_receiver_balance.balance, 0) - v_old_receiver_adjustment;

    UPDATE public.client_balances
    SET
      balance = v_old_receiver_new_balance,
      updated_at = v_now
    WHERE id = v_old_receiver_balance.id;
  ELSIF v_old_wallet_credited THEN
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
    END,
    -- El estado sólo se mueve cuando la corrección cambia el destino del
    -- dinero. Un envío que ya era de ventanilla conserva su estado EXACTO
    -- (`created` sigue siendo `created`): la corrección nunca fue una máquina
    -- de estados y no debe empezar a serlo por este cambio.
    status = CASE
      WHEN p_receiver_user_id IS NOT NULL THEN 'completed'
      -- Se desvincula de una cuenta: el dinero vuelve a la ventanilla y su
      -- código recupera validez.
      WHEN v_old_wallet_credited THEN 'available_for_pickup'
      ELSE status
    END,
    completed_at = CASE
      WHEN p_receiver_user_id IS NOT NULL THEN COALESCE(completed_at, v_now)
      WHEN v_old_wallet_credited THEN NULL
      ELSE completed_at
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
      'new_status', v_transfer.status,
      'wallet_credit_adjusted', p_receiver_user_id IS NOT NULL OR v_previous_receiver_user_id IS NOT NULL
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

  IF v_old_wallet_credited AND v_old_receiver_adjustment > 0 THEN
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
      v_old_receiver_new_balance - COALESCE(v_old_receiver_balance.reserved_balance, 0),
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
      v_new_receiver_new_balance - COALESCE(v_new_receiver_balance.reserved_balance, 0),
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

-- ---------------------------------------------------------------------------
-- 9. Normalización de los envíos ya acreditados
-- ---------------------------------------------------------------------------
--
-- Estos envíos YA pusieron el dinero en la billetera del cliente, pero seguían
-- con el código vivo. No hay movimiento de saldo que hacer: sólo se cierra el
-- estado para que ningún código pueda volver a cobrarlos en ventanilla, que es
-- exactamente la dependencia que esta migración elimina.

UPDATE public.transfers
SET
  status = 'completed',
  completed_at = COALESCE(completed_at, wallet_credited_at, NOW())
WHERE transfer_type = 'agent'
  AND receiver_user_id IS NOT NULL
  AND wallet_credited_at IS NOT NULL
  AND wallet_debited_at IS NULL
  AND status IN ('created', 'available_for_pickup');

COMMIT;
