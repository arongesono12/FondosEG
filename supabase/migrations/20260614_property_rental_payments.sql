-- ============================================
-- Migration: Property & Rental payments integration
-- Adds the domain tables, ledger functions and inbound webhook log
-- used to connect FondosEG with the external payments app.
-- Run this in the Supabase SQL Editor.
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------
-- Properties listed by an owner (gestor/admin)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  monthly_rent DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'rented', 'inactive')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_owner ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);

-- --------------------------------------------
-- Rental agreements (leases) linking a tenant to a property
-- tenant_id is nullable because tenants may live only in the payments app.
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tenant_name TEXT NOT NULL,
  tenant_phone TEXT NOT NULL,
  tenant_email TEXT,
  rent_amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  billing_day INTEGER NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'cancelled')),
  start_date DATE,
  end_date DATE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentals_property ON public.rentals(property_id);
CREATE INDEX IF NOT EXISTS idx_rentals_owner ON public.rentals(owner_id);
CREATE INDEX IF NOT EXISTS idx_rentals_tenant ON public.rentals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON public.rentals(status);

-- --------------------------------------------
-- Individual rent payments processed through the external payments app.
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')),
  payment_method TEXT,
  provider TEXT,
  provider_payment_id TEXT,
  provider_reference TEXT,
  provider_checkout_url TEXT,
  idempotency_key TEXT,
  failure_reason TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_payments_rental_created
  ON public.rental_payments(rental_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_payments_owner ON public.rental_payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_tenant ON public.rental_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_status ON public.rental_payments(status);

-- One external charge maps to at most one payment row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_payments_provider_payment
  ON public.rental_payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- Idempotency for client-initiated payment creation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_payments_idempotency
  ON public.rental_payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- --------------------------------------------
-- Inbound webhook events received from the external payments app.
-- Acts as an idempotency + audit log for provider callbacks.
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  rental_payment_id UUID REFERENCES public.rental_payments(id) ON DELETE SET NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_provider_events_payment
  ON public.payment_provider_events(rental_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_provider_events_status
  ON public.payment_provider_events(status, created_at DESC);

-- --------------------------------------------
-- Row Level Security
-- The public API uses the service-role key (bypasses RLS); these policies
-- protect the same tables when read from the dashboard with a user session.
-- --------------------------------------------
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins manage properties" ON public.properties;
CREATE POLICY "Owners and admins manage properties"
  ON public.properties FOR ALL
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Parties can read rentals" ON public.rentals;
CREATE POLICY "Parties can read rentals"
  ON public.rentals FOR SELECT
  USING (
    owner_id = auth.uid()
    OR tenant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Parties can read rental payments" ON public.rental_payments;
CREATE POLICY "Parties can read rental payments"
  ON public.rental_payments FOR SELECT
  USING (
    owner_id = auth.uid()
    OR tenant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins read provider events" ON public.payment_provider_events;
CREATE POLICY "Admins read provider events"
  ON public.payment_provider_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- --------------------------------------------
-- RPC: create a pending rental payment
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.create_rental_payment_operation(
  p_rental_id UUID,
  p_actor_user_id UUID DEFAULT NULL,
  p_period TEXT DEFAULT NULL,
  p_amount DECIMAL DEFAULT 0,
  p_currency TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_rental public.rentals%ROWTYPE;
  v_payment public.rental_payments%ROWTYPE;
  v_amount DECIMAL;
  v_currency TEXT;
  v_period TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_rental
  FROM public.rentals
  WHERE id = p_rental_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El alquiler no existe';
  END IF;

  IF v_rental.status <> 'active' THEN
    RAISE EXCEPTION 'El alquiler no está activo';
  END IF;

  v_amount := COALESCE(NULLIF(p_amount, 0), v_rental.rent_amount);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  v_currency := COALESCE(NULLIF(p_currency, ''), v_rental.currency, 'XAF');
  v_period := COALESCE(NULLIF(p_period, ''), to_char(v_now, 'YYYY-MM'));

  INSERT INTO public.rental_payments (
    rental_id,
    property_id,
    owner_id,
    tenant_id,
    period,
    amount,
    currency,
    status,
    payment_method,
    provider,
    idempotency_key,
    metadata
  )
  VALUES (
    v_rental.id,
    v_rental.property_id,
    v_rental.owner_id,
    v_rental.tenant_id,
    v_period,
    v_amount,
    v_currency,
    'pending',
    p_payment_method,
    p_provider,
    p_idempotency_key,
    p_metadata
  )
  RETURNING * INTO v_payment;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_actor_user_id,
    'create_rental_payment',
    'rental_payment',
    v_payment.id,
    jsonb_build_object(
      'rental_id', v_rental.id,
      'property_id', v_rental.property_id,
      'amount', v_amount,
      'currency', v_currency,
      'period', v_period
    ),
    v_now
  );

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    currency,
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    v_rental.owner_id,
    p_actor_user_id,
    'system',
    'rental_payment_created',
    v_amount,
    v_currency,
    'rental_payment',
    v_payment.id,
    jsonb_build_object('rental_id', v_rental.id, 'period', v_period, 'provider', p_provider)
  );

  RETURN jsonb_build_object('payment', to_jsonb(v_payment));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------
-- RPC: update a rental payment status (used by provider webhook + outbound client)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.update_rental_payment_status_operation(
  p_payment_id UUID,
  p_status TEXT,
  p_provider_payment_id TEXT DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL,
  p_provider_checkout_url TEXT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_payment public.rental_payments%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_status NOT IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled') THEN
    RAISE EXCEPTION 'Estado de pago inválido';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.rental_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pago no existe';
  END IF;

  -- Terminal states are not overwritten by late/duplicate callbacks.
  IF v_payment.status IN ('paid', 'refunded', 'cancelled') AND v_payment.status = p_status THEN
    RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'changed', FALSE);
  END IF;

  UPDATE public.rental_payments
  SET
    status = p_status,
    provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
    provider_reference = COALESCE(p_provider_reference, provider_reference),
    provider_checkout_url = COALESCE(p_provider_checkout_url, provider_checkout_url),
    failure_reason = CASE WHEN p_status = 'failed' THEN COALESCE(p_failure_reason, failure_reason) ELSE failure_reason END,
    paid_at = CASE WHEN p_status = 'paid' THEN COALESCE(paid_at, v_now) ELSE paid_at END,
    metadata = CASE WHEN p_metadata IS NULL THEN metadata ELSE COALESCE(metadata, '{}'::jsonb) || p_metadata END,
    updated_at = v_now
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    p_actor_user_id,
    'update_rental_payment_status',
    'rental_payment',
    v_payment.id,
    jsonb_build_object('status', p_status, 'provider_payment_id', v_payment.provider_payment_id),
    v_now
  );

  INSERT INTO public.financial_events (
    owner_user_id,
    actor_user_id,
    ledger_scope,
    event_type,
    amount,
    currency,
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    v_payment.owner_id,
    p_actor_user_id,
    'system',
    concat('rental_payment_', p_status),
    v_payment.amount,
    v_payment.currency,
    'rental_payment',
    v_payment.id,
    jsonb_build_object('provider', v_payment.provider, 'provider_payment_id', v_payment.provider_payment_id)
  );

  RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'changed', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
