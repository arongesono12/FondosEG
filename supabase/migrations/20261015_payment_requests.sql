-- ---------------------------------------------------------------------------
-- Solicitudes de cobro (payment requests)
-- ---------------------------------------------------------------------------
--
-- Permite que un integrador (p. ej. CasasEG) cobre a un cliente de FondosEG
-- desde SU billetera sin custodiar credenciales del cliente:
--
--   1. El integrador crea la solicitud con su API key (`payments`). El
--      importe se abonará en la billetera del dueño de esa key (comercio).
--   2. FondosEG devuelve un `checkout_url`. El cliente inicia sesión, revisa
--      el importe y confirma.
--   3. `pay_payment_request` debita al cliente y abona al comercio en UNA
--      transacción, reutilizando `create_wallet_transfer_settled_operation`.
--   4. FondosEG emite `payment_request.paid` a los webhooks del comercio.
--
-- Una solicitud solo puede pagarse una vez: la fila se bloquea FOR UPDATE y
-- el estado se comprueba dentro de la misma transacción que mueve el dinero.

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE RESTRICT,
  merchant_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  merchant_name TEXT NOT NULL,
  external_reference TEXT NOT NULL CHECK (length(external_reference) BETWEEN 1 AND 100),
  payment_reference TEXT CHECK (payment_reference IS NULL OR length(payment_reference) <= 100),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0 AND amount <= 10000000),
  currency TEXT NOT NULL DEFAULT 'XAF' CHECK (currency ~ '^[A-Z]{3}$'),
  description TEXT CHECK (description IS NULL OR length(description) <= 300),
  payer_phone TEXT CHECK (payer_phone IS NULL OR length(payer_phone) <= 32),
  payer_user_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
  return_url TEXT CHECK (return_url IS NULL OR length(return_url) <= 500),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  wallet_transfer_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- El mismo pedido del integrador nunca genera dos cobros, aunque rote la key.
  CONSTRAINT payment_requests_merchant_reference_key UNIQUE (merchant_user_id, external_reference)
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_merchant_created
  ON public.payment_requests (merchant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status_expires
  ON public.payment_requests (status, expires_at);

-- Solo el backend (service_role) lee y escribe. El cliente ve la solicitud a
-- través de la página de pago, que la carga en el servidor.
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_payment_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_payment_requests ON public.payment_requests;
CREATE TRIGGER touch_payment_requests
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_payment_requests_updated_at();

-- ---------------------------------------------------------------------------
-- Pago atómico de una solicitud
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pay_payment_request(
  p_request_id UUID,
  p_payer_id UUID,
  p_regulation_code TEXT,
  p_disclosure_version TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.payment_requests%ROWTYPE;
  v_payer public.users%ROWTYPE;
  v_merchant public.users%ROWTYPE;
  v_payer_currency TEXT;
  v_merchant_currency TEXT;
  v_result JSONB;
  v_notes TEXT;
BEGIN
  SELECT * INTO v_request
  FROM public.payment_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment request is not pending';
  END IF;

  IF v_request.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Payment request has expired';
  END IF;

  IF v_request.merchant_user_id = p_payer_id THEN
    RAISE EXCEPTION 'Sender and receiver are the same account';
  END IF;

  SELECT * INTO v_payer FROM public.users WHERE id = p_payer_id;
  IF NOT FOUND OR v_payer.role <> 'cliente' THEN
    RAISE EXCEPTION 'Sender is not a valid client';
  END IF;

  IF COALESCE(btrim(v_payer.phone), '') = '' THEN
    RAISE EXCEPTION 'Payer phone is required';
  END IF;

  -- Si el comercio indicó quién debe pagar, solo ese cliente puede hacerlo
  -- (se comparan solo los dígitos para tolerar formatos distintos).
  IF COALESCE(btrim(v_request.payer_phone), '') <> ''
     AND right(regexp_replace(v_request.payer_phone, '\D', '', 'g'), 9)
         <> right(regexp_replace(v_payer.phone, '\D', '', 'g'), 9) THEN
    RAISE EXCEPTION 'Payer does not match payment request';
  END IF;

  SELECT * INTO v_merchant FROM public.users WHERE id = v_request.merchant_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiver is not a valid client';
  END IF;

  -- La billetera opera en una sola divisa y no hay conversión en ninguna capa:
  -- tanto el pagador como el comercio deben operar en la divisa de la solicitud.
  SELECT currency INTO v_payer_currency
  FROM public.client_balances
  WHERE client_id = p_payer_id;

  IF v_payer_currency IS NOT NULL AND v_payer_currency <> v_request.currency THEN
    RAISE EXCEPTION 'Currency mismatch';
  END IF;

  SELECT currency INTO v_merchant_currency
  FROM public.client_balances
  WHERE client_id = v_merchant.id;

  IF v_merchant_currency IS NOT NULL AND v_merchant_currency <> v_request.currency THEN
    RAISE EXCEPTION 'Currency mismatch';
  END IF;

  v_notes := left(
    concat_ws(' | ',
      'Pago a ' || v_request.merchant_name,
      COALESCE(v_request.payment_reference, v_request.external_reference),
      v_request.description
    ),
    500
  );

  v_result := public.create_wallet_transfer_settled_operation(
    p_payer_id,
    v_merchant.id,
    v_payer.name,
    v_payer.phone,
    v_request.merchant_name,
    COALESCE(v_merchant.phone, ''),
    v_request.amount,
    v_request.currency,
    v_notes,
    'payment_request',
    p_regulation_code,
    p_disclosure_version,
    'payment_request',
    p_ip_address,
    p_user_agent
  );

  UPDATE public.payment_requests
  SET status = 'paid',
      payer_user_id = p_payer_id,
      wallet_transfer_id = NULLIF(v_result -> 'transfer' ->> 'id', '')::UUID,
      paid_at = NOW()
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'request', to_jsonb(v_request),
    'transfer', v_result -> 'transfer',
    'payer_available_balance', v_result -> 'sender_available_balance'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_payment_request(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_payment_request(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Liberar una clave de idempotencia cuya operación NO movió dinero
-- ---------------------------------------------------------------------------
--
-- `claim_api_idempotency_key` nunca roba una clave en `processing`, porque no
-- sabe si el dinero se movió. Pero cuando la RPC financiera lanzó una
-- excepción de Postgres, la transacción se revirtió entera: no hubo
-- movimiento y la clave debe quedar libre para que el integrador reintente
-- (p. ej. tras recargar saldo). Solo la libera quien tiene el lock_token.

CREATE OR REPLACE FUNCTION public.release_api_idempotency_key(
  p_api_key_id UUID,
  p_idempotency_key TEXT,
  p_lock_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.api_idempotency_keys
  WHERE api_key_id = p_api_key_id
    AND idempotency_key = p_idempotency_key
    AND lock_token = p_lock_token
    AND response_status IS NULL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.release_api_idempotency_key(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_api_idempotency_key(UUID, TEXT, UUID) TO service_role;
