-- ============================================================================
-- Entrega de SMS y webhooks fuera de la confirmación del envío
-- ============================================================================
--
-- POR QUÉ
--
-- POST /api/transfers esperaba a Twilio y a los endpoints de los clientes de
-- webhooks antes de responder. Un proveedor lento retrasaba la confirmación de
-- un envío ya registrado, y la cola se procesaba sin reclamar los trabajos: dos
-- ejecuciones simultáneas podían enviar el mismo SMS o el mismo webhook.
--
-- QUÉ HACE ESTA MIGRACIÓN
--
-- 1. Reclamación atómica con arrendamiento (lease). `claim_*` marca un lote con
--    `FOR UPDATE SKIP LOCKED`: dos workers nunca reciben la misma fila. Si un
--    worker muere a mitad, el lease caduca y otro retoma el trabajo. El intento
--    se cuenta al reclamar, así un trabajo que tumba al worker no se reintenta
--    indefinidamente. La entrega es «al menos una vez»: si el proceso cae justo
--    después de que Twilio acepte el SMS y antes de anotarlo, se reenviará.
--
-- 2. Reintentos para SMS. `notification_outbox` gana `next_attempt_at`,
--    `max_attempts` y `locked_until`; antes un fallo transitorio de Twilio era
--    definitivo.
--
-- 3. Consentimiento atómico. `create_agent_transfer_with_consent_operation` crea el envío
--    de gestor y registra la evidencia de consentimiento en la misma
--    transacción, como ya hace el envío entre billeteras
--    (20260826_wallet_transfer_instant_settlement.sql). Antes se insertaba
--    después y, si fallaba, la API devolvía error con el dinero ya movido; un
--    reintento del usuario duplicaba el envío.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columnas de reintento y lease
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status_next_attempt
  ON public.notification_outbox(status, next_attempt_at);

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. Reclamación de SMS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_notification_outbox(
  p_limit INTEGER DEFAULT 20,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Trabajos cuyo worker murió y ya agotaron sus intentos: se cierran.
  WITH exhausted AS (
    UPDATE public.notification_outbox o
    SET status = 'failed',
        locked_until = NULL,
        processed_at = NOW(),
        error_message = COALESCE(o.error_message, 'Worker interrumpido; intentos agotados')
    WHERE o.status = 'processing'
      AND o.locked_until < NOW()
      AND o.attempts >= o.max_attempts
    RETURNING o.notification_id, o.error_message
  )
  UPDATE public.notifications n
  SET status = 'failed', error_message = e.error_message
  FROM exhausted e
  WHERE n.id = e.notification_id;

  RETURN QUERY
  WITH picked AS (
    SELECT o.id
    FROM public.notification_outbox o
    WHERE (o.status = 'pending' AND o.next_attempt_at <= NOW())
       OR (o.status = 'processing' AND o.locked_until < NOW() AND o.attempts < o.max_attempts)
    ORDER BY o.created_at
    LIMIT GREATEST(LEAST(p_limit, 100), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_outbox o
  SET status = 'processing',
      attempts = o.attempts + 1,
      locked_until = NOW() + make_interval(secs => GREATEST(p_lease_seconds, 10))
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reclamación de webhooks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(
  p_limit INTEGER DEFAULT 20,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS SETOF public.webhook_deliveries
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.webhook_deliveries d
  SET status = 'failed',
      locked_until = NULL,
      processed_at = NOW(),
      error_message = COALESCE(d.error_message, 'Worker interrumpido; intentos agotados')
  WHERE d.status IN ('pending', 'retrying')
    AND d.locked_until < NOW()
    AND d.attempt_count >= d.max_attempts;

  RETURN QUERY
  WITH picked AS (
    SELECT d.id
    FROM public.webhook_deliveries d
    WHERE d.status IN ('pending', 'retrying')
      AND d.next_attempt_at <= NOW()
      AND (d.locked_until IS NULL OR d.locked_until < NOW())
      AND d.attempt_count < d.max_attempts
    ORDER BY d.created_at
    LIMIT GREATEST(LEAST(p_limit, 100), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.webhook_deliveries d
  SET attempt_count = d.attempt_count + 1,
      locked_until = NOW() + make_interval(secs => GREATEST(p_lease_seconds, 10))
  FROM picked
  WHERE d.id = picked.id
  RETURNING d.*;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Envío de gestor + evidencia de consentimiento en una transacción
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_agent_transfer_with_consent_operation(
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
  p_receiver_user_id UUID,
  p_regulation_code TEXT,
  p_disclosure_version TEXT,
  p_consent_channel TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_regulation_code IS NULL OR p_disclosure_version IS NULL THEN
    RAISE EXCEPTION 'Falta la evidencia de consentimiento del servicio de pago';
  END IF;

  v_result := public.create_agent_transfer_operation(
    p_agent_id, p_actor_user_id, p_transfer_code,
    p_sender_name, p_sender_phone, p_sender_document_type, p_sender_document_number,
    p_receiver_name, p_receiver_phone, p_receiver_document_type, p_receiver_document_number,
    p_destination_city, p_destination_country, p_amount, p_currency, p_notes, p_receiver_user_id
  );

  -- Si este INSERT falla, la transacción entera (saldo incluido) se deshace.
  INSERT INTO public.compliance_events (
    user_id, event_type, regulation_code, disclosure_version,
    entity_type, entity_id, ip_address, user_agent, metadata
  )
  VALUES (
    p_actor_user_id, 'payment_consent', p_regulation_code, p_disclosure_version,
    'agent_transfer', (v_result -> 'transfer' ->> 'id')::UUID, p_ip_address, p_user_agent,
    jsonb_build_object(
      'amount', p_amount,
      'currency', p_currency,
      'fee_amount', COALESCE((v_result ->> 'commission_amount')::DECIMAL, 0),
      'beneficiary_name', p_receiver_name,
      'channel', p_consent_channel,
      'consent', true
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_outbox(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_agent_transfer_with_consent_operation(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_agent_transfer_with_consent_operation(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
