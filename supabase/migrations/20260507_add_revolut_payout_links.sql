-- Store external payout-link state for transfers paid through Revolut.

ALTER TABLE public.transfers
ADD COLUMN IF NOT EXISTS payout_provider TEXT NOT NULL DEFAULT 'agent',
ADD COLUMN IF NOT EXISTS payout_reference_id TEXT,
ADD COLUMN IF NOT EXISTS payout_url TEXT,
ADD COLUMN IF NOT EXISTS payout_state TEXT,
ADD COLUMN IF NOT EXISTS payout_request_id TEXT,
ADD COLUMN IF NOT EXISTS payout_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payout_methods TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS payout_raw JSONB;

ALTER TABLE public.transfers
DROP CONSTRAINT IF EXISTS transfers_payout_provider_check;

ALTER TABLE public.transfers
ADD CONSTRAINT transfers_payout_provider_check
CHECK (payout_provider IN ('agent', 'revolut'));

ALTER TABLE public.transfers
DROP CONSTRAINT IF EXISTS transfers_payout_state_check;

ALTER TABLE public.transfers
ADD CONSTRAINT transfers_payout_state_check
CHECK (
  payout_state IS NULL
  OR payout_state IN ('created', 'failed', 'awaiting', 'active', 'expired', 'cancelled', 'processing', 'processed')
);

CREATE INDEX IF NOT EXISTS idx_transfers_payout_provider
  ON public.transfers(payout_provider);

CREATE INDEX IF NOT EXISTS idx_transfers_payout_reference_id
  ON public.transfers(payout_reference_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_payout_request_id
  ON public.transfers(payout_request_id)
  WHERE payout_request_id IS NOT NULL;
