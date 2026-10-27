-- ============================================================================
-- Credenciales por APLICACIÓN, no por rol
-- ============================================================================
--
-- PROBLEMA
--
-- Hasta ahora una API key operaba la billetera de una PERSONA: la del propio
-- desarrollador o, si el superadmin escribía su teléfono, la de un cliente
-- (p. ej. la cuenta de CasasEG). Para integrar otra aplicación había que
-- elegir un rol y conocer el teléfono de la billetera que iba a cobrar y
-- pagar, y si el desarrollador no tenía teléfono los envíos fallaban.
--
-- MODELO NUEVO
--
-- Cada integración es una `api_application` con su PROPIA billetera de cliente
-- (una fila de `users` con rol `cliente`, sin teléfono ni identidad de Clerk,
-- así que nadie puede iniciar sesión con ella). Sus credenciales y webhooks
-- apuntan a esa billetera (`user_id = wallet_user_id`), de modo que todas las
-- rutas existentes —saldo, envíos, cobros, vínculos y eventos— funcionan sin
-- cambios: los cobros se abonan a la aplicación y los envíos salen de ella.
--
--   api_applications.owner_user_id   quién la gestiona en el portal
--   api_applications.wallet_user_id  billetera que opera la aplicación
--   api_applications.is_trusted      creada por el superadmin: puede pedir a
--                                    los clientes ver su saldo (vínculos)
--
-- Las credenciales anteriores se agrupan en aplicaciones que conservan la
-- billetera que ya operaban, así que nada deja de funcionar.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Aplicaciones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.api_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  -- Sin FK, igual que `api_keys.issued_by_user_id`: el gestor puede ser una
  -- identidad solo-desarrollador.
  owner_user_id UUID NOT NULL,
  wallet_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  -- FALSE en las heredadas: varias podían compartir la billetera de una persona.
  has_dedicated_wallet BOOLEAN NOT NULL DEFAULT TRUE,
  is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_applications_owner
  ON public.api_applications (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_applications_wallet
  ON public.api_applications (wallet_user_id);

-- Una billetera propia pertenece a una sola aplicación.
CREATE UNIQUE INDEX IF NOT EXISTS api_applications_dedicated_wallet_key
  ON public.api_applications (wallet_user_id)
  WHERE has_dedicated_wallet;

ALTER TABLE public.api_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_applications FROM PUBLIC, anon, authenticated;

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.api_applications(id) ON DELETE SET NULL;

ALTER TABLE public.webhook_subscriptions
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.api_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_application
  ON public.api_keys (application_id)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_application
  ON public.webhook_subscriptions (application_id)
  WHERE application_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Alta atómica: billetera + saldo + aplicación
-- ---------------------------------------------------------------------------
--
-- La billetera nace activa y verificada, sin teléfono, email ni Clerk: nadie
-- puede entrar con ella ni encontrarla por teléfono para enviarle dinero. Solo
-- recibe cobros (solicitudes de pago) y solo la operan las credenciales de la
-- aplicación.

CREATE OR REPLACE FUNCTION public.create_api_application(
  p_name TEXT,
  p_description TEXT,
  p_owner_user_id UUID,
  p_is_trusted BOOLEAN DEFAULT FALSE,
  p_currency TEXT DEFAULT 'XAF'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_wallet_id UUID;
  v_application public.api_applications%ROWTYPE;
BEGIN
  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Application name is invalid';
  END IF;

  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Application owner is required';
  END IF;

  INSERT INTO public.users (name, role, is_active, is_verified)
  VALUES (v_name, 'cliente', TRUE, TRUE)
  RETURNING id INTO v_wallet_id;

  INSERT INTO public.client_balances (client_id, balance, reserved_balance, currency)
  VALUES (v_wallet_id, 0, 0, COALESCE(NULLIF(btrim(p_currency), ''), 'XAF'));

  INSERT INTO public.api_applications (
    name, description, owner_user_id, wallet_user_id, has_dedicated_wallet, is_trusted
  )
  VALUES (
    v_name, NULLIF(btrim(COALESCE(p_description, '')), ''), p_owner_user_id, v_wallet_id, TRUE, COALESCE(p_is_trusted, FALSE)
  )
  RETURNING * INTO v_application;

  RETURN to_jsonb(v_application);
END;
$$;

REVOKE ALL ON FUNCTION public.create_api_application(TEXT, TEXT, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_api_application(TEXT, TEXT, UUID, BOOLEAN, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Credenciales y webhooks anteriores
-- ---------------------------------------------------------------------------
--
-- Una aplicación por (billetera, nombre de app). Conserva la billetera que la
-- credencial ya operaba; la gestiona quien la emitió. Las emitidas por el
-- superadmin para un cliente son de confianza, como hasta ahora.

INSERT INTO public.api_applications (
  name, description, owner_user_id, wallet_user_id, has_dedicated_wallet, is_trusted, created_at
)
SELECT DISTINCT ON (k.user_id, lower(left(btrim(k.app_name), 80)))
  left(btrim(k.app_name), 80),
  left(k.app_description, 500),
  COALESCE(k.issued_by_user_id, k.user_id),
  k.user_id,
  FALSE,
  k.issued_by_user_id IS NOT NULL,
  k.created_at
FROM public.api_keys k
WHERE k.application_id IS NULL
  AND char_length(btrim(COALESCE(k.app_name, ''))) > 0
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = k.user_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.api_applications a
    WHERE a.wallet_user_id = k.user_id
      AND lower(a.name) = lower(left(btrim(k.app_name), 80))
  )
ORDER BY k.user_id, lower(left(btrim(k.app_name), 80)), k.created_at;

UPDATE public.api_keys k
SET application_id = a.id
FROM public.api_applications a
WHERE k.application_id IS NULL
  AND a.wallet_user_id = k.user_id
  AND lower(a.name) = lower(left(btrim(k.app_name), 80));

-- El webhook va con la aplicación más antigua de su misma billetera; la
-- entrega de eventos sigue dependiendo solo de `user_id`.
UPDATE public.webhook_subscriptions w
SET application_id = (
  SELECT a.id
  FROM public.api_applications a
  WHERE a.wallet_user_id = w.user_id
  ORDER BY a.created_at
  LIMIT 1
)
WHERE w.application_id IS NULL
  AND EXISTS (SELECT 1 FROM public.api_applications a WHERE a.wallet_user_id = w.user_id);

COMMIT;

-- ---------------------------------------------------------------------------
-- 4. La billetera de una aplicación puede cobrar
-- ---------------------------------------------------------------------------
--
-- `create_wallet_transfer_settled_operation` (la usan los envíos del panel,
-- los de la API y el pago de solicitudes de cobro) exige que el beneficiario
-- pueda entrar al panel. La billetera de una aplicación no inicia sesión, pero
-- sí debe recibir los cobros de su aplicación: se acepta también una
-- billetera de aplicación activa. El resto de la función es idéntico a
-- 20260826_wallet_transfer_instant_settlement.sql.

BEGIN;

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
     OR (
       NOT EXISTS (
         SELECT 1
         FROM public.account_access
         WHERE user_id = v_receiver.id
           AND product = 'dashboard'
           AND status = 'active'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM public.api_applications
         WHERE wallet_user_id = v_receiver.id
           AND status = 'active'
       )
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

COMMIT;
