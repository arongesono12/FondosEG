BEGIN;

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_url TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  signing_secret_encrypted TEXT NOT NULL,
  signing_secret_preview TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_user_id
  ON public.webhook_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_status
  ON public.webhook_subscriptions(status);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  request_body JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription_created
  ON public.webhook_deliveries(subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_next_attempt
  ON public.webhook_deliveries(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_id
  ON public.webhook_deliveries(event_id);

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own webhook subscriptions" ON public.webhook_subscriptions;
CREATE POLICY "Users can manage own webhook subscriptions"
  ON public.webhook_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Users can read own webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.webhook_subscriptions ws
      WHERE ws.id = webhook_deliveries.subscription_id
        AND ws.user_id = auth.uid()
    )
  );

COMMIT;
