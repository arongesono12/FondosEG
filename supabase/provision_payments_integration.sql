-- ============================================
-- Provision REAL credentials for the external payments app.
-- Run this ONCE in the Supabase SQL Editor AFTER applying
-- 20260614_property_rental_payments.sql.
--
-- It creates a production API key (sk_live_...) with the `properties` and
-- `payments` scopes so the payments app can call FondosEG's external API.
-- The plaintext secret is printed in the NOTICES tab — copy it immediately,
-- it is stored only as a SHA-256 hash and cannot be recovered later.
--
-- The OUTBOUND secrets (FondosEG -> payments app) are NOT stored here; set
-- PAYMENTS_PROVIDER_* as project secrets (see .env.example).
-- ============================================

DO $$
DECLARE
  v_owner  UUID;
  v_key    TEXT;
  v_secret TEXT;
  v_hash   TEXT;
BEGIN
  -- Owner of the credential: the first admin/superadmin. Adjust the WHERE
  -- clause to pin a specific account, e.g. WHERE email = 'you@example.com'.
  SELECT id INTO v_owner
  FROM public.users
  WHERE role IN ('admin', 'superadmin')
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'No se encontró un usuario admin/superadmin para asignar la credencial';
  END IF;

  v_key    := 'sk_live_' || encode(gen_random_bytes(24), 'hex');
  v_secret := encode(gen_random_bytes(32), 'hex');
  v_hash   := encode(digest(v_secret, 'sha256'), 'hex');

  INSERT INTO public.api_keys (
    app_name,
    app_description,
    api_key,
    api_secret,
    api_secret_hash,
    api_secret_preview,
    environment,
    user_id,
    role_access,
    permissions,
    rate_limit,
    rate_limit_window_minutes,
    is_active
  )
  VALUES (
    'Payments App',
    'Integración bidireccional de pagos de alquiler/propiedades',
    v_key,
    v_hash,
    v_hash,
    concat(left(v_secret, 6), '...', right(v_secret, 4)),
    'production',
    v_owner,
    'admin',
    '{"balance": true, "transfer": false, "history": true, "properties": true, "payments": true}'::jsonb,
    600,
    60,
    true
  );

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Credencial para la app de pagos creada.';
  RAISE NOTICE 'x-api-key:    %', v_key;
  RAISE NOTICE 'x-api-secret: %  (guárdalo ahora, no se vuelve a mostrar)', v_secret;
  RAISE NOTICE '====================================================';
END $$;

-- ----------------------------------------------------------------
-- OUTBOUND webhooks (FondosEG -> payments app):
-- Register the subscription from the dashboard at /webhooks (or the
-- POST /api/webhooks endpoint) pointing target_url to the payments app and
-- subscribing to: rental_payment.created, rental_payment.paid,
-- rental_payment.failed, rental_payment.refunded, rental_payment.cancelled.
-- The signing secret must be encrypted with WEBHOOK_ENCRYPTION_KEY, which is
-- why it is created through the app rather than raw SQL.
-- ----------------------------------------------------------------
