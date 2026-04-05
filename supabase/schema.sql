-- FondosEG Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'gestor', 'cliente')) DEFAULT 'cliente',
  document_type TEXT,
  document_number TEXT,
  country TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for role-based queries
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_users_email ON public.users(email);

-- ============================================
-- AGENT BALANCES TABLE
-- ============================================
CREATE TABLE public.agent_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_balances_agent_id ON public.agent_balances(agent_id);

-- ============================================
-- CLIENT BALANCES TABLE (New for client-to-client transfers)
-- ============================================
CREATE TABLE public.client_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_balances_client_id ON public.client_balances(client_id);

-- ============================================
-- TRANSFERS TABLE
-- ============================================
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_code TEXT NOT NULL UNIQUE,
  transfer_type TEXT NOT NULL DEFAULT 'agent' CHECK (transfer_type IN ('agent', 'client')),
  agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  sender_document_type TEXT,
  sender_document_number TEXT,
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_country TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL CHECK (status IN ('created', 'completed', 'cancelled')) DEFAULT 'created',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_transfers_agent_id ON public.transfers(agent_id);
CREATE INDEX idx_transfers_code ON public.transfers(transfer_code);
CREATE INDEX idx_transfers_status ON public.transfers(status);
CREATE INDEX idx_transfers_created_at ON public.transfers(created_at);
CREATE INDEX idx_transfers_sender_phone ON public.transfers(sender_phone);
CREATE INDEX idx_transfers_receiver_phone ON public.transfers(receiver_phone);

-- ============================================
-- BALANCE TRANSACTIONS TABLE (Audit Trail)
-- ============================================
CREATE TABLE public.balance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topup', 'transfer', 'refund', 'commission', 'reset')),
  amount DECIMAL(15, 2) NOT NULL,
  previous_balance DECIMAL(15, 2) NOT NULL,
  new_balance DECIMAL(15, 2) NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_balance_transactions_agent_id ON public.balance_transactions(agent_id);
CREATE INDEX idx_balance_transactions_type ON public.balance_transactions(type);
CREATE INDEX idx_balance_transactions_created_at ON public.balance_transactions(created_at);

-- ============================================
-- ACTIVITY LOGS TABLE (Audit)
-- ============================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);

-- ============================================
-- NOTIFICATIONS TABLE (SMS Tracking)
-- ============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID REFERENCES public.transfers(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  twilio_sid TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_transfer_id ON public.notifications(transfer_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);

-- ============================================
-- EMAIL VERIFICATION TABLE
-- ============================================
CREATE TABLE public.email_verification (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  code        TEXT        NOT NULL,
  attempts    INTEGER     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verification_user_id ON public.email_verification(user_id);
CREATE INDEX idx_email_verification_email ON public.email_verification(email);
CREATE INDEX idx_email_verification_expires_at ON public.email_verification(expires_at);

-- ============================================
-- SETUP ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR USERS
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Admins can manage all users
CREATE POLICY "Admins can manage all users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR AGENT BALANCES
-- ============================================

-- Agents can read their own balance
CREATE POLICY "Agents can read own balance"
  ON public.agent_balances FOR SELECT
  USING (agent_id = auth.uid());

-- Admins can read all balances
CREATE POLICY "Admins can read all balances"
  ON public.agent_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all balances
CREATE POLICY "Admins can update all balances"
  ON public.agent_balances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR CLIENT BALANCES
-- ============================================

-- Clients can read their own balance
CREATE POLICY "Clients can read own balance"
  ON public.client_balances FOR SELECT
  USING (client_id = auth.uid());

-- Admins can read all client balances
CREATE POLICY "Admins can read all client balances"
  ON public.client_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins and clients can update client balances
CREATE POLICY "Clients can update own balance"
  ON public.client_balances FOR UPDATE
  USING (client_id = auth.uid());

CREATE POLICY "Admins can update all client balances"
  ON public.client_balances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR TRANSFERS
-- ============================================

-- Agents can read their own transfers
CREATE POLICY "Agents can read own transfers"
  ON public.transfers FOR SELECT
  USING (agent_id = auth.uid());

-- Clients can read their own transfers (as sender)
CREATE POLICY "Clients can read own transfers"
  ON public.transfers FOR SELECT
  USING (sender_id = auth.uid());

-- Admins can read all transfers
CREATE POLICY "Admins can read all transfers"
  ON public.transfers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Agents can create transfers
CREATE POLICY "Agents can create transfers"
  ON public.transfers FOR INSERT
  WITH CHECK (agent_id = auth.uid());

-- Agents can update their own transfers (cancel)
CREATE POLICY "Agents can update own transfers"
  ON public.transfers FOR UPDATE
  USING (agent_id = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins can manage all transfers"
  ON public.transfers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR BALANCE TRANSACTIONS
-- ============================================

-- Agents can read their own transactions
CREATE POLICY "Agents can read own transactions"
  ON public.balance_transactions FOR SELECT
  USING (agent_id = auth.uid());

-- Admins can read all transactions
CREATE POLICY "Admins can read all transactions"
  ON public.balance_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR ACTIVITY LOGS
-- ============================================

-- Users can read their own activity
CREATE POLICY "Users can read own activity"
  ON public.activity_logs FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all activity
CREATE POLICY "Admins can read all activity"
  ON public.activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR NOTIFICATIONS
-- ============================================

-- Same as transfers - based on agent_id through transfer
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transfers t
      WHERE t.id = transfer_id AND t.agent_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR EMAIL VERIFICATION
-- ============================================

-- Users read their own verifications
CREATE POLICY "Users read own verifications"
  ON public.email_verification FOR SELECT
  USING (user_id = auth.uid());

-- Admins read all verifications
CREATE POLICY "Admins read all verifications"
  ON public.email_verification FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- FUNCTION: Create user profile trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users
  INSERT INTO public.users (id, name, email, phone, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente')
  );

  -- If it's a gestor, create agent balance
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'cliente') = 'gestor' THEN
    INSERT INTO public.agent_balances (agent_id, balance, currency)
    VALUES (NEW.id, 0, 'XAF');
  END IF;

  -- If it's a cliente, create client balance
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'cliente') = 'cliente' THEN
    INSERT INTO public.client_balances (client_id, balance, currency)
    VALUES (NEW.id, 0, 'XAF');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION: Generate transfer code
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_transfer_code()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  random_part TEXT;
  new_code TEXT;
  existing_code TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  random_part := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  new_code := 'TRX-' || year_part || '-' || random_part;

  -- Ensure uniqueness
  SELECT transfer_code INTO existing_code
  FROM public.transfers
  WHERE transfer_code = new_code;

  IF existing_code IS NOT NULL THEN
    RETURN public.generate_transfer_code();
  END IF;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Log activity
-- ============================================
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS FOR DASHBOARD
-- ============================================

-- View: Agent with balance info
CREATE OR REPLACE VIEW public.agents_with_balance AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.phone,
  u.role,
  u.is_active,
  u.created_at,
  COALESCE(ab.balance, 0) as balance
FROM public.users u
LEFT JOIN public.agent_balances ab ON u.id = ab.agent_id
WHERE u.role = 'gestor';

-- View: Daily transfer statistics
CREATE OR REPLACE VIEW public.daily_transfer_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as transfer_count,
  SUM(amount) as total_amount,
  COUNT(DISTINCT agent_id) as agent_count
FROM public.transfers
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: Agent transfer statistics
CREATE OR REPLACE VIEW public.agent_transfer_stats AS
SELECT 
  t.agent_id,
  u.name as agent_name,
  COUNT(t.id) as transfer_count,
  SUM(t.amount) as total_sent,
  MAX(t.created_at) as last_transfer
FROM public.transfers t
JOIN public.users u ON t.agent_id = u.id
WHERE t.status = 'completed'
GROUP BY t.agent_id, u.name
ORDER BY total_sent DESC;
