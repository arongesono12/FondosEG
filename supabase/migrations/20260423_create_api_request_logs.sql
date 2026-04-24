BEGIN;

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  error_code TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_api_key_created
  ON public.api_request_logs(api_key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_request_id
  ON public.api_request_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_path_created
  ON public.api_request_logs(path, created_at DESC);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read API request logs" ON public.api_request_logs;
CREATE POLICY "Admins can read API request logs"
  ON public.api_request_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'superadmin')
    )
  );

COMMIT;
