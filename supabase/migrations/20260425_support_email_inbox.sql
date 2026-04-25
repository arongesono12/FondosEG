BEGIN;

ALTER TABLE public.support_messages
ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS email_message_id TEXT,
ADD COLUMN IF NOT EXISTS email_subject TEXT,
ADD COLUMN IF NOT EXISTS email_from TEXT,
ADD COLUMN IF NOT EXISTS email_to TEXT,
ADD COLUMN IF NOT EXISTS email_received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_direction TEXT CHECK (email_direction IN ('inbound', 'outbound'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_email_message_id
  ON public.support_messages(email_message_id)
  WHERE email_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_messages_email_direction_received
  ON public.support_messages(email_direction, email_received_at DESC)
  WHERE email_direction IS NOT NULL;

COMMIT;
