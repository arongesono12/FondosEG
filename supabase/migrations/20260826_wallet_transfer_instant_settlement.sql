-- ============================================================================
-- Envío entre clientes: entrega inmediata, sin código
-- ============================================================================
--
-- CAMBIO DE MODELO
--
-- Hasta ahora el envío entre clientes era un vale al portador: el emisor creaba
-- una orden, el importe quedaba RETENIDO, se generaba un código de 6 dígitos y
-- el dinero no se movía hasta que el beneficiario lo confirmaba con ese código.
--
-- A partir de aquí el envío entre clientes se comporta como el envío de un
-- gestor a un cliente registrado (`20260823_client_wallet_self_custody.sql`):
-- se LIQUIDA en el acto. El saldo del emisor baja al enviar, el del
-- beneficiario sube a la vez y la orden nace `confirmed`. No hay código, no hay
-- retención y no hay nada que confirmar.
--
-- El código sigue existiendo donde sí tiene sentido: cuando un cliente emite un
-- vale contra su PROPIO saldo para cobrarlo en efectivo en una ventanilla
-- (`client_withdrawals`). Ahí quien presenta el código es quien cobra, y por eso
-- el importe se retiene mientras el vale vive.
--
-- POR QUÉ
--
-- El modelo anterior mezclaba dos cosas distintas. Entre dos cuentas de la
-- misma aplicación no hace falta un vale: el beneficiario ya está identificado
-- y el dinero puede ir directo a su billetera. El código sólo añadía un paso
-- que podía no completarse nunca, y con él un importe inmovilizado hasta
-- caducar.
--
-- QUÉ HACE ESTA MIGRACIÓN
--
--   1. `create_wallet_transfer_settled_operation`: crea el envío ya liquidado,
--      con la evidencia de consentimiento en la MISMA transacción.
--   2. Liquida las órdenes que quedasen pendientes del modelo anterior.
--   3. Marca como heredadas las funciones del modelo de vale.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Envío liquidado en el acto
-- ---------------------------------------------------------------------------
--
-- La evidencia de consentimiento se escribe AQUÍ, no en la capa de servicio.
-- Con el modelo de retención se podía anular la orden si ese registro fallaba,
-- porque no se había entregado nada todavía. Con entrega inmediata el dinero ya
-- está en la billetera del beneficiario en ese momento: la única forma de que
-- no exista una operación sin su evidencia es escribir ambas a la vez.

CREATE OR REPLACE FUNCTION public.create_wallet_transfer_settled_operation(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_sender_name TEXT,
  p_sender_phone TEXT,
  p_receiver_name TEXT,
  p_receiver_phone TEXT,
  p_amount DECIMAL,
  p_currency TEXT DEFAULT 'XAF',
  p_notes TEXT DEFAULT NULL,
  p_origin_channel TEXT DEFAULT 'dashboard',
  p_regulation_code TEXT DEFAULT NULL,
  p_disclosure_version TEXT DEFAULT NULL,
  p_consent_channel TEXT DEFAULT 'dashboard_wallet',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sender public.users%ROWTYPE;
  v_receiver public.users%ROWTYPE;
  v_sender_balance public.client_balances%ROWTYPE;
  v_receiver_balance public.client_balances%ROWTYPE;
  v_transfer public.wallet_transfers%ROWTYPE;
  v_sender_reserved DECIMAL := 0;
  v_receiver_reserved DECIMAL := 0;
  v_available DECIMAL := 0;
  v_sender_new DECIMAL := 0;
  v_receiver_new DECIMAL := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  IF p_regulation_code IS NULL OR p_disclosure_version IS NULL THEN
    RAISE EXCEPTION 'Payment consent evidence is required';
  END IF;

  SELECT * INTO v_sender FROM public.users WHERE id = p_sender_id;
  IF NOT FOUND OR v_sender.role <> 'cliente' THEN
    RAISE EXCEPTION 'Sender is not a valid client';
  END IF;

  SELECT * INTO v_receiver FROM public.users WHERE id = p_receiver_id;
  IF NOT FOUND OR v_receiver.role <> 'cliente' THEN
    RAISE EXCEPTION 'Receiver is not a valid client';
  END IF;

  IF v_receiver.id = v_sender.id THEN
    RAISE EXCEPTION 'Sender and receiver are the same account';
  END IF;

  -- Mismo requisito que exige el inicio de sesión: una cuenta que no puede
  -- entrar tampoco puede disponer de lo que se le entregue.
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

  INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
  VALUES (p_receiver_id, 0, 0, p_currency)
  ON CONFLICT (client_id) DO NOTHING;

  -- Las dos filas se bloquean en UNA sentencia y en orden de `client_id`.
  -- Bloquearlas por separado permitiría un abrazo mortal entre dos envíos
  -- simultáneos en sentidos opuestos.
  PERFORM 1
  FROM public.client_balances
  WHERE client_id IN (p_sender_id, p_receiver_id)
  ORDER BY client_id
  FOR UPDATE;

  SELECT * INTO v_sender_balance FROM public.client_balances WHERE client_id = p_sender_id;
  SELECT * INTO v_receiver_balance FROM public.client_balances WHERE client_id = p_receiver_id;

  v_sender_reserved := COALESCE(v_sender_balance.reserved_balance, 0);
  v_receiver_reserved := COALESCE(v_receiver_balance.reserved_balance, 0);

  -- DISPONIBLE, no bruto: lo retenido por un código de retiro vivo del propio
  -- emisor ya está comprometido y no se puede volver a enviar.
  v_available := COALESCE(v_sender_balance.balance, 0) - v_sender_reserved;
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_sender_new := COALESCE(v_sender_balance.balance, 0) - p_amount;
  v_receiver_new := COALESCE(v_receiver_balance.balance, 0) + p_amount;

  UPDATE public.client_balances
  SET balance = v_sender_new, updated_at = v_now
  WHERE id = v_sender_balance.id;

  UPDATE public.client_balances
  SET balance = v_receiver_new, updated_at = v_now
  WHERE id = v_receiver_balance.id;

  -- Sin `verification_code`, sin `reserved_at` y sin `expires_at`: no hay vale
  -- que presentar ni plazo que agotar. La orden nace liquidada.
  INSERT INTO public.wallet_transfers (
    sender_id, receiver_id, sender_name, sender_phone,
    receiver_name, receiver_phone, amount, currency,
    verification_code, status, notes, confirmed_at, origin_channel
  )
  VALUES (
    p_sender_id, p_receiver_id, p_sender_name, p_sender_phone,
    p_receiver_name, p_receiver_phone, p_amount, p_currency,
    NULL, 'confirmed', p_notes, v_now, p_origin_channel
  )
  RETURNING * INTO v_transfer;

  INSERT INTO public.financial_events (
    owner_user_id, actor_user_id, ledger_scope, event_type,
    amount, reserved_amount, currency,
    available_balance_after, reserved_balance_after,
    reference_type, reference_id, metadata
  )
  VALUES
    (
      p_sender_id, p_sender_id, 'client', 'wallet_transfer_debited',
      -p_amount, 0, p_currency,
      v_sender_new - v_sender_reserved, v_sender_reserved,
      'wallet_transfer', v_transfer.id,
      jsonb_build_object('origin_channel', p_origin_channel, 'settlement', 'instant')
    ),
    (
      p_receiver_id, p_sender_id, 'client', 'wallet_transfer_received',
      p_amount, 0, p_currency,
      v_receiver_new - v_receiver_reserved, v_receiver_reserved,
      'wallet_transfer', v_transfer.id,
      jsonb_build_object('origin_channel', p_origin_channel, 'settlement', 'instant')
    );

  INSERT INTO public.compliance_events (
    user_id, event_type, regulation_code, disclosure_version,
    entity_type, entity_id, ip_address, user_agent, metadata
  )
  VALUES (
    p_sender_id, 'payment_consent', p_regulation_code, p_disclosure_version,
    'wallet_transfer', v_transfer.id, p_ip_address, p_user_agent,
    jsonb_build_object(
      'amount', p_amount,
      'currency', p_currency,
      'fee_amount', 0,
      'beneficiary_name', p_receiver_name,
      'channel', p_consent_channel,
      'consent', true
    )
  );

  RETURN jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'sender_balance', v_sender_new,
    'sender_available_balance', v_sender_new - v_sender_reserved,
    'receiver_balance', v_receiver_new
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 2. Órdenes del modelo anterior que siguieran vivas
-- ---------------------------------------------------------------------------
--
-- Con el modelo nuevo no puede quedar ninguna orden `pending`: sería un importe
-- retenido esperando un código que la aplicación ya no pide en ninguna parte.
--
-- Las caducadas se liberan (nadie llegó a cobrarlas). Las vigentes se LIQUIDAN
-- reutilizando `confirm_wallet_transfer_operation` con `p_skip_code_check`, que
-- es exactamente lo que habría pasado si el beneficiario hubiera confirmado:
-- debita, abona, marca `confirmed` y deja los dos asientos contables. Es la
-- entrega que el emisor pidió al crearlas.

DO $$
DECLARE
  r RECORD;
  v_released INTEGER := 0;
  v_settled INTEGER := 0;
BEGIN
  v_released := public.release_expired_wallet_transfers(NULL);

  FOR r IN
    SELECT id, receiver_id, amount, currency
    FROM public.wallet_transfers
    WHERE status = 'pending'
    ORDER BY created_at
  LOOP
    PERFORM public.confirm_wallet_transfer_operation(r.id, NULL, r.receiver_id, TRUE);
    v_settled := v_settled + 1;
    RAISE NOTICE 'Liquidada orden heredada % (% %)', r.id, r.amount, r.currency;
  END LOOP;

  RAISE NOTICE 'Órdenes caducadas liberadas: %. Órdenes vigentes liquidadas: %.', v_released, v_settled;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Funciones del modelo de vale: heredadas
-- ---------------------------------------------------------------------------
--
-- No se eliminan. Siguen siendo correctas y son las que han liquidado las
-- órdenes del paso 2; borrarlas rompería cualquier consulta o script que aún
-- las nombre. El comentario deja claro en la propia base de datos que ya no
-- forman parte del flujo vivo.

COMMENT ON FUNCTION public.create_wallet_transfer_hold(UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, TEXT, TEXT) IS
  'HEREDADA. Modelo de vale con código, sustituido por create_wallet_transfer_settled_operation en 20260826. No la invoca ningún camino vivo.';

COMMENT ON FUNCTION public.confirm_wallet_transfer_operation(UUID, TEXT, UUID, BOOLEAN) IS
  'HEREDADA. Sólo liquidaba órdenes del modelo de vale. Desde 20260826 el envío entre clientes nace liquidado y no hay nada que confirmar.';

COMMENT ON FUNCTION public.release_expired_wallet_transfers(UUID) IS
  'HEREDADA. Sin órdenes en estado pending no tiene nada que barrer; se conserva por si quedara alguna del modelo anterior.';

-- ---------------------------------------------------------------------------
-- 4. Verificación
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_pending INTEGER;
  v_reserved_por_ordenes DECIMAL;
BEGIN
  IF to_regprocedure('public.create_wallet_transfer_settled_operation(uuid,uuid,text,text,text,text,numeric,text,text,text,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'No se ha creado create_wallet_transfer_settled_operation';
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.wallet_transfers
  WHERE status = 'pending';

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Siguen % orden(es) en pending: el modelo nuevo no las contempla', v_pending;
  END IF;

  -- Ninguna retención de billetera debe sobrevivir. Lo que quede retenido sólo
  -- puede venir de códigos de retiro vivos, que es donde el vale sí aplica.
  SELECT COALESCE(sum(b.reserved_balance), 0) INTO v_reserved_por_ordenes
  FROM public.client_balances b
  WHERE b.reserved_balance > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.client_withdrawals w
      WHERE w.client_id = b.client_id AND w.status = 'pending'
    );

  IF v_reserved_por_ordenes > 0 THEN
    RAISE WARNING 'Hay % retenido sin ningún código de retiro vivo detrás. Revísalo.', v_reserved_por_ordenes;
  END IF;

  RAISE NOTICE 'OK: envío entre clientes liquidado en el acto, sin órdenes pendientes.';
END $$;

COMMIT;

-- ============================================================================
-- COMPROBACIÓN MANUAL (opcional, tras aplicar)
--
--   -- No debe quedar ninguna:
--   SELECT count(*) FROM public.wallet_transfers WHERE status = 'pending';
--
--   -- Los envíos nuevos nacen sin código y confirmados:
--   SELECT status, verification_code, reserved_at, expires_at, confirmed_at
--   FROM public.wallet_transfers ORDER BY created_at DESC LIMIT 5;
--
--   -- Lo retenido debe corresponder sólo a códigos de retiro vivos:
--   SELECT b.client_id, b.reserved_balance,
--          COALESCE((SELECT sum(w.amount) FROM public.client_withdrawals w
--                    WHERE w.client_id = b.client_id AND w.status = 'pending'), 0) AS por_retiros
--   FROM public.client_balances b WHERE b.reserved_balance > 0;
-- ============================================================================
