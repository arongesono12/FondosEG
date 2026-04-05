-- ============================================================
-- Migration: Add email_verification table + is_verified column
-- Run this in Supabase SQL Editor → fondoseg project
-- ============================================================

-- 1. Add is_verified column to public.users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'is_verified'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Create email_verification table
CREATE TABLE IF NOT EXISTS public.email_verification (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  code        TEXT        NOT NULL,
  attempts    INTEGER     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id
  ON public.email_verification(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_email
  ON public.email_verification(email);

CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at
  ON public.email_verification(expires_at);

-- 4. Enable RLS
ALTER TABLE public.email_verification ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (service role bypasses RLS, so these cover anon/authenticated reads)
-- Only admins or the owning user can read their verifications
DROP POLICY IF EXISTS "Users read own verifications" ON public.email_verification;
CREATE POLICY "Users read own verifications"
  ON public.email_verification FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all
DROP POLICY IF EXISTS "Admins read all verifications" ON public.email_verification;
CREATE POLICY "Admins read all verifications"
  ON public.email_verification FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Auto-cleanup: delete expired/verified records older than 24 hours
--    (optional — run manually or via cron edge function)
-- DELETE FROM public.email_verification
--   WHERE verified_at IS NOT NULL OR expires_at < NOW() - INTERVAL '24 hours';
