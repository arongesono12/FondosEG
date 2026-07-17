BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.api_idempotency_keys
  ADD COLUMN IF NOT EXISTS lock_token UUID,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.public_endpoint_rate_limits (
  bucket_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket_key, window_started_at)
);

ALTER TABLE public.public_endpoint_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_endpoint_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_api_key_id UUID,
  p_window_started_at TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_limit < 1 THEN
    RAISE EXCEPTION 'invalid rate limit';
  END IF;

  INSERT INTO public.api_key_usage_windows (
    api_key_id, window_started_at, request_count, updated_at
  ) VALUES (
    p_api_key_id, p_window_started_at, 1, NOW()
  )
  ON CONFLICT (api_key_id, window_started_at)
  DO UPDATE SET
    request_count = public.api_key_usage_windows.request_count + 1,
    updated_at = NOW()
  WHERE public.api_key_usage_windows.request_count < p_limit
  RETURNING request_count INTO v_count;

  RETURN COALESCE(v_count, p_limit + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_public_endpoint_rate_limit(
  p_bucket_key TEXT,
  p_window_started_at TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF length(p_bucket_key) < 16 OR p_limit < 1 THEN
    RAISE EXCEPTION 'invalid rate limit input';
  END IF;

  INSERT INTO public.public_endpoint_rate_limits (
    bucket_key, window_started_at, request_count, updated_at
  ) VALUES (
    p_bucket_key, p_window_started_at, 1, NOW()
  )
  ON CONFLICT (bucket_key, window_started_at)
  DO UPDATE SET
    request_count = public.public_endpoint_rate_limits.request_count + 1,
    updated_at = NOW()
  WHERE public.public_endpoint_rate_limits.request_count < p_limit
  RETURNING request_count INTO v_count;

  RETURN COALESCE(v_count, p_limit + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_api_idempotency_key(
  p_api_key_id UUID,
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_lock_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_id UUID;
  v_row public.api_idempotency_keys%ROWTYPE;
BEGIN
  IF length(p_idempotency_key) < 1 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'invalid idempotency key';
  END IF;

  INSERT INTO public.api_idempotency_keys (
    api_key_id, idempotency_key, request_hash, lock_token,
    processing_started_at, updated_at
  ) VALUES (
    p_api_key_id, p_idempotency_key, p_request_hash, p_lock_token,
    NOW(), NOW()
  )
  ON CONFLICT (api_key_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NOT NULL THEN
    RETURN jsonb_build_object('state', 'acquired', 'lock_token', p_lock_token);
  END IF;

  SELECT * INTO v_row
  FROM public.api_idempotency_keys
  WHERE api_key_id = p_api_key_id AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_row.request_hash <> p_request_hash THEN
    RETURN jsonb_build_object('state', 'conflict');
  END IF;

  IF v_row.response_status IS NOT NULL AND v_row.response_body IS NOT NULL THEN
    RETURN jsonb_build_object(
      'state', 'completed',
      'response_status', v_row.response_status,
      'response_body', v_row.response_body
    );
  END IF;

  -- Never automatically steal an incomplete financial operation. If the
  -- worker crashed after committing money movement but before recording the
  -- response, retrying could duplicate the movement. Operations in this state
  -- require reconciliation rather than unsafe automatic replay.
  RETURN jsonb_build_object('state', 'processing');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_api_idempotency_key(
  p_api_key_id UUID,
  p_idempotency_key TEXT,
  p_lock_token UUID,
  p_response_status INTEGER,
  p_response_body JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.api_idempotency_keys
  SET response_status = p_response_status,
      response_body = p_response_body,
      lock_token = NULL,
      updated_at = NOW()
  WHERE api_key_id = p_api_key_id
    AND idempotency_key = p_idempotency_key
    AND lock_token = p_lock_token
    AND response_status IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(UUID, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_public_endpoint_rate_limit(TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_api_idempotency_key(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_api_idempotency_key(UUID, TEXT, UUID, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(UUID, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_public_endpoint_rate_limit(TEXT, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_api_idempotency_key(UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_api_idempotency_key(UUID, TEXT, UUID, INTEGER, JSONB) TO service_role;

COMMIT;
