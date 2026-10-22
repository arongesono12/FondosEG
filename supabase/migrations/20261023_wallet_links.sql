-- ---------------------------------------------------------------------------
-- Vínculos de billetera (wallet links): saldo de solo lectura para integradores
-- ---------------------------------------------------------------------------
--
-- Permite que un integrador (p. ej. CasasEG) muestre a SU usuario el saldo de
-- la billetera FondosEG de ese usuario, sin custodiar sus credenciales:
--
--   1. El integrador crea una solicitud de vínculo con su API key (`payments`)
--      y recibe un `authorize_url`.
--   2. El cliente inicia sesión en FondosEG y autoriza (o rechaza). FondosEG
--      genera un código de un solo uso y vuelve al `return_url` del integrador.
--   3. El integrador canjea el código por un token `balance:read`. FondosEG
--      solo guarda el hash del token y del código.
--   4. Con su API key + el token, el integrador lee el saldo. El cliente o el
--      integrador pueden revocar el vínculo en cualquier momento.
--
-- El token no permite mover dinero ni leer movimientos.

-- `api_key_id` es solo trazabilidad: rotar o borrar la key no debe romper los
-- vínculos de los clientes (la autorización va por `merchant_user_id`).
CREATE TABLE IF NOT EXISTS public.wallet_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  merchant_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  external_user_ref TEXT NOT NULL CHECK (length(external_user_ref) BETWEEN 1 AND 100),
  return_url TEXT NOT NULL CHECK (length(return_url) <= 500),
  state TEXT NOT NULL CHECK (length(state) BETWEEN 8 AND 128),
  payer_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash TEXT UNIQUE,
  code_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'consumed')),
  expires_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_link_requests_merchant_created
  ON public.wallet_link_requests (merchant_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.wallet_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  merchant_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  payer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  external_user_ref TEXT NOT NULL CHECK (length(external_user_ref) BETWEEN 1 AND 100),
  scopes TEXT[] NOT NULL DEFAULT ARRAY['balance:read']::TEXT[]
    CHECK (scopes <@ ARRAY['balance:read']::TEXT[]),
  token_hash TEXT NOT NULL UNIQUE,
  link_request_id UUID NOT NULL REFERENCES public.wallet_link_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT CHECK (revoked_by IS NULL OR revoked_by IN ('payer', 'merchant', 'relink'))
);

-- Un cliente tiene como mucho un vínculo activo con cada comercio.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_links_active_pair
  ON public.wallet_links (merchant_user_id, payer_user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_links_payer_active
  ON public.wallet_links (payer_user_id)
  WHERE revoked_at IS NULL;

-- Solo el backend (service_role) lee y escribe.
ALTER TABLE public.wallet_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_link_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.wallet_links FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Canje atómico del código por un vínculo
-- ---------------------------------------------------------------------------
--
-- Bloquea la solicitud FOR UPDATE para que un mismo código nunca cree dos
-- vínculos, aunque el integrador reintente en paralelo. Un vínculo anterior
-- entre el mismo comercio y cliente queda revocado (`relink`).

CREATE OR REPLACE FUNCTION public.redeem_wallet_link_code(
  p_code_hash TEXT,
  p_merchant_user_id UUID,
  p_api_key_id UUID,
  p_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.wallet_link_requests%ROWTYPE;
  v_link public.wallet_links%ROWTYPE;
  v_payer_phone TEXT;
BEGIN
  SELECT * INTO v_request
  FROM public.wallet_link_requests
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  -- Mismo error para "no existe" y "es de otro comercio": no revela códigos ajenos.
  IF NOT FOUND OR v_request.merchant_user_id <> p_merchant_user_id THEN
    RAISE EXCEPTION 'Wallet link code is invalid';
  END IF;

  IF v_request.status <> 'approved' THEN
    RAISE EXCEPTION 'Wallet link code was already used';
  END IF;

  IF v_request.code_expires_at IS NULL OR v_request.code_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Wallet link code has expired';
  END IF;

  UPDATE public.wallet_links
  SET revoked_at = NOW(), revoked_by = 'relink'
  WHERE merchant_user_id = v_request.merchant_user_id
    AND payer_user_id = v_request.payer_user_id
    AND revoked_at IS NULL;

  INSERT INTO public.wallet_links (
    api_key_id, merchant_user_id, merchant_name, payer_user_id,
    external_user_ref, token_hash, link_request_id
  ) VALUES (
    p_api_key_id, v_request.merchant_user_id, v_request.merchant_name, v_request.payer_user_id,
    v_request.external_user_ref, p_token_hash, v_request.id
  )
  RETURNING * INTO v_link;

  UPDATE public.wallet_link_requests
  SET status = 'consumed', consumed_at = NOW()
  WHERE id = v_request.id;

  SELECT phone INTO v_payer_phone FROM public.users WHERE id = v_request.payer_user_id;

  RETURN jsonb_build_object(
    'link_id', v_link.id,
    'scopes', to_jsonb(v_link.scopes),
    'external_user_ref', v_link.external_user_ref,
    'payer_phone', v_payer_phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_wallet_link_code(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_wallet_link_code(TEXT, UUID, UUID, TEXT) TO service_role;
