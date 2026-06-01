BEGIN;

ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production';

ALTER TABLE public.api_keys
DROP CONSTRAINT IF EXISTS api_keys_environment_check;

ALTER TABLE public.api_keys
ADD CONSTRAINT api_keys_environment_check
CHECK (environment IN ('test', 'production'));

UPDATE public.api_keys
SET environment = 'production'
WHERE environment IS NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_environment
  ON public.api_keys(environment);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_environment
  ON public.api_keys(user_id, environment);

CREATE OR REPLACE FUNCTION public.generate_api_key(p_environment TEXT DEFAULT 'test')
RETURNS TEXT AS $$
DECLARE
  key_prefix TEXT;
BEGIN
  key_prefix := CASE
    WHEN p_environment = 'production' THEN 'sk_live_'
    ELSE 'sk_test_'
  END;

  RETURN key_prefix || encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
