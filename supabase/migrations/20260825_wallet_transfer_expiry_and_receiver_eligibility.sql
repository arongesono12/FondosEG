-- ============================================================================
-- Billetera entre clientes: caducidad que libera de verdad y destinatarios
-- que puedan cobrar
-- ============================================================================
--
-- Corrige dos huecos del flujo de envío entre clientes. Ambos terminan en lo
-- mismo: dinero retenido en la billetera del emisor que nadie puede mover.
--
-- ---------------------------------------------------------------------------
-- HUECO 1 — «tener ficha» no es lo mismo que «poder cobrar»
-- ---------------------------------------------------------------------------
--
-- Los dos caminos que crean una orden exigen que el beneficiario exista en
-- `users` con `role = 'cliente'`, pero ninguno mira si esa cuenta puede
-- iniciar sesión. Una cuenta con `is_active = FALSE`, o cuyo
-- `account_access(dashboard)` esté en 'pending' o 'suspended', es un destino
-- aceptado hoy: se retiene el importe al emisor y el beneficiario no puede
-- entrar a confirmarlo. La orden se queda viva 24 horas y el dinero,
-- inmovilizado.
--
-- Se exige exactamente lo mismo que exige el inicio de sesión
-- (`requireProductAccess('dashboard')` en `lib/server/authz.ts`): cuenta
-- activa Y acceso al panel en 'active'. La comprobación se añade en las DOS
-- funciones que insertan en `wallet_transfers`, no sólo en la capa de
-- servicio, para que ningún llamador pueda saltársela.
--
-- ---------------------------------------------------------------------------
-- HUECO 2 — la caducidad no liberaba nada
-- ---------------------------------------------------------------------------
--
-- `confirm_wallet_transfer_operation` detectaba la caducidad, liberaba la
-- retención, marcaba la orden como 'expired' y a continuación hacía:
--
--     RAISE EXCEPTION 'Transfer has expired';
--
-- `RAISE EXCEPTION` aborta la transacción. Las dos escrituras anteriores se
-- revertían con ella, así que la orden seguía 'pending' y el importe seguía
-- retenido. Y como no existía ningún barrido de órdenes caducadas —los
-- retiros sí lo tienen, `release_expired_client_withdrawals`—, ese saldo no
-- volvía a estar disponible nunca.
--
-- La corrección separa las dos responsabilidades:
--
--   * `release_expired_wallet_transfers(p_client_id)` libera y marca, en su
--     propia transacción, que sí persiste. La aplicación la invoca en cada
--     lectura de saldo, en cada listado y antes de crear o confirmar una
--     orden, igual que ya hace con los retiros caducados.
--   * `confirm_wallet_transfer_operation` se limita a rechazar la orden
--     caducada, sin escrituras que iban a revertirse igualmente.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Barrido de órdenes caducadas
-- ---------------------------------------------------------------------------
--
-- Con `p_client_id` limita el barrido a un emisor (lo habitual: la lectura de
-- su propio saldo). Sin él barre todo, para poder invocarla desde una tarea
-- programada si algún día se quiere.
--
-- El bloqueo va en el mismo orden que `confirm_wallet_transfer_operation`
-- —primero la orden, después el saldo— para no introducir un abrazo mortal
-- entre el barrido y una confirmación simultánea. `SKIP LOCKED` deja pasar la
-- fila que ya esté bloqueada por una confirmación en curso: esa confirmación
-- fallará por su cuenta con 'Transfer has expired' y el siguiente barrido la
-- recogerá.

CREATE OR REPLACE FUNCTION public.release_expired_wallet_transfers(
  p_client_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  r RECORD;
  v_balance public.client_balances%ROWTYPE;
  v_reserved DECIMAL := 0;
  v_available DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
  v_released INTEGER := 0;
BEGIN
  FOR r IN
    SELECT *
    FROM public.wallet_transfers
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < v_now
      AND (p_client_id IS NULL OR sender_id = p_client_id)
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT *
    INTO v_balance
    FROM public.client_balances
    WHERE client_id = r.sender_id
    FOR UPDATE;

    IF FOUND THEN
      v_reserved := GREATEST(COALESCE(v_balance.reserved_balance, 0) - r.amount, 0);

      UPDATE public.client_balances
      SET reserved_balance = v_reserved, updated_at = v_now
      WHERE id = v_balance.id;

      v_available := COALESCE(v_balance.balance, 0) - v_reserved;
    ELSE
      -- Sin fila de saldo no hay retención que liberar, pero la orden tiene
      -- que dejar de estar viva igualmente: sigue siendo cobrable mientras
      -- esté 'pending'.
      v_reserved := 0;
      v_available := 0;
    END IF;

    UPDATE public.wallet_transfers
    SET status = 'expired', released_at = v_now
    WHERE id = r.id;

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
      r.sender_id,
      r.sender_id,
      'client',
      'wallet_transfer_expired',
      0,
      -r.amount,
      r.currency,
      v_available,
      v_reserved,
      'wallet_transfer',
      r.id,
      jsonb_build_object('expired_at', v_now, 'expires_at', r.expires_at)
    );

    v_released := v_released + 1;
  END LOOP;

  RETURN v_released;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El barrido filtra por (status, expires_at) en cada lectura de saldo.
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_status_expires
  ON public.wallet_transfers(status, expires_at);

-- ---------------------------------------------------------------------------
-- 2. Creación de la orden: el destinatario tiene que poder cobrarla
-- ---------------------------------------------------------------------------

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
  v_receiver public.users%ROWTYPE;
  v_sender_balance public.client_balances%ROWTYPE;
  v_transfer public.wallet_transfers%ROWTYPE;
  v_available_balance DECIMAL := 0;
  v_reserved_balance DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  -- El servicio ya resuelve al beneficiario por teléfono, pero la RPC es
  -- invocable por cualquier llamador con service role: la regla «sin cuenta no
  -- hay envío» tiene que sostenerse también aquí.
  SELECT *
  INTO v_receiver
  FROM public.users
  WHERE id = p_receiver_id;

  IF NOT FOUND OR v_receiver.role <> 'cliente' THEN
    RAISE EXCEPTION 'Receiver is not a valid client';
  END IF;

  -- Tener ficha en `users` no basta: una cuenta desactivada, o con el acceso
  -- al panel retirado, no puede iniciar sesión para confirmar la orden. El
  -- importe quedaría retenido en la billetera del emisor hasta caducar. Se
  -- exige lo MISMO que exige el inicio de sesión
  -- (`requireProductAccess('dashboard')` en lib/server/authz.ts).
  IF COALESCE(v_receiver.is_active, TRUE) = FALSE
     OR NOT EXISTS (
       SELECT 1
       FROM public.account_access
       WHERE user_id = v_receiver.id
         AND product = 'dashboard'
         AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'Receiver account is not active';
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

-- ---------------------------------------------------------------------------
-- 3. Confirmación: la caducidad deja de intentar escribir lo que se revierte
-- ---------------------------------------------------------------------------

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

  -- Una orden ya barrida llega aquí como 'expired'. Distinguirla da al
  -- beneficiario el motivo real en lugar de un genérico "ya no está
  -- pendiente".
  IF v_transfer.status = 'expired' THEN
    RAISE EXCEPTION 'Transfer has expired';
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

  -- Aquí se liberaba la retención y se marcaba la orden como 'expired' ANTES
  -- de lanzar la excepción. No servía de nada: `RAISE EXCEPTION` aborta la
  -- transacción y revertía esas dos escrituras, de modo que la orden seguía
  -- 'pending' y el importe seguía retenido en la billetera del emisor para
  -- siempre. Liberar es cosa de `release_expired_wallet_transfers`, que corre
  -- en su propia transacción y sí persiste.
  IF v_transfer.expires_at IS NOT NULL AND v_transfer.expires_at < v_now THEN
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

-- ---------------------------------------------------------------------------
-- 4. Camino de la API de integradores: mismo requisito de destinatario
-- ---------------------------------------------------------------------------

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

  -- Tener ficha en `users` no basta: una cuenta desactivada, o con el acceso
  -- al panel retirado, no puede iniciar sesión para confirmar la orden. El
  -- importe quedaría retenido en la billetera del emisor hasta caducar. Se
  -- exige lo MISMO que exige el inicio de sesión
  -- (`requireProductAccess('dashboard')` en lib/server/authz.ts).
  IF COALESCE(v_receiver.is_active, TRUE) = FALSE
     OR NOT EXISTS (
       SELECT 1
       FROM public.account_access
       WHERE user_id = v_receiver.id
         AND product = 'dashboard'
         AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'Receiver account is not active';
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

-- ---------------------------------------------------------------------------
-- 5. Verificación
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  IF to_regprocedure('public.release_expired_wallet_transfers(uuid)') IS NULL THEN
    RAISE EXCEPTION 'No se ha creado release_expired_wallet_transfers';
  END IF;

  -- El texto que se acaba de retirar de la rama de caducidad. Si sigue en el
  -- cuerpo de la función, el CREATE OR REPLACE no ha surtido efecto.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'confirm_wallet_transfer_operation'
      AND p.prosrc LIKE '%SET status = ''expired'', released_at = v_now%'
  ) THEN
    RAISE EXCEPTION 'confirm_wallet_transfer_operation sigue liberando la retención antes de lanzar la excepción';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY['create_wallet_transfer_hold', 'create_wallet_transfer_direct_operation'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_fn
        AND p.prosrc LIKE '%Receiver account is not active%'
    ) THEN
      RAISE EXCEPTION 'Falta la comprobación de destinatario activo en %', v_fn;
    END IF;
  END LOOP;

  RAISE NOTICE 'OK: barrido de caducadas creado y destinatario validado en ambos caminos.';
END $$;

COMMIT;

-- ============================================================================
-- COMPROBACIÓN MANUAL (opcional, tras aplicar)
--
--   -- Órdenes vivas que ya han caducado (debe quedar 0 tras un barrido):
--   SELECT count(*) FROM public.wallet_transfers
--   WHERE status = 'pending' AND expires_at < NOW();
--
--   -- Barrido global a mano:
--   SELECT public.release_expired_wallet_transfers();
--
--   -- Retenido por cliente frente a órdenes vivas (deben cuadrar):
--   SELECT b.client_id, b.reserved_balance,
--          COALESCE((SELECT sum(w.amount) FROM public.wallet_transfers w
--                    WHERE w.sender_id = b.client_id AND w.status = 'pending'), 0)
--            AS retenido_por_ordenes
--   FROM public.client_balances b
--   WHERE b.reserved_balance > 0;
-- ============================================================================
