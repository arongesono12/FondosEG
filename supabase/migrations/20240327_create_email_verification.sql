-- ============================================
-- Migration: Create email_verification table for OTP
-- Run this in Supabase SQL Editor
-- ============================================

-- Table for storing OTP codes for email verification
CREATE TABLE IF NOT EXISTS public.email_verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON public.email_verification(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_code ON public.email_verification(code);
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON public.email_verification(user_id);

-- Enable RLS
ALTER TABLE public.email_verification ENABLE ROW LEVEL SECURITY;

-- Policy: Only the system can insert/update/delete
CREATE POLICY "System can manage email verification"
  ON public.email_verification FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM auth.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Users can read their own verification records
CREATE POLICY "Users can read own verification"
  ON public.email_verification FOR SELECT
  USING (user_id = auth.uid());

-- Add is_verified column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_token UUID;

-- Create function to clean up expired OTP codes
CREATE OR REPLACE FUNCTION cleanup_expired_otp()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_verification 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
