BEGIN;

CREATE TABLE IF NOT EXISTS public.compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  regulation_code TEXT NOT NULL,
  disclosure_version TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_events_user_created
  ON public.compliance_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_events_entity
  ON public.compliance_events(entity_type, entity_id);

ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own compliance events" ON public.compliance_events;
CREATE POLICY "Users can read own compliance events"
  ON public.compliance_events FOR SELECT
  USING (auth.uid() = user_id);

ALTER TABLE public.support_messages
ADD COLUMN IF NOT EXISTS complaint_reference TEXT,
ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
ADD COLUMN IF NOT EXISTS complaint_category TEXT,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_complaint_reference
  ON public.support_messages(complaint_reference)
  WHERE complaint_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_messages_transaction_reference
  ON public.support_messages(transaction_reference)
  WHERE transaction_reference IS NOT NULL;

COMMIT;
