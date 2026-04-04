-- Add cash balance to agent balances for dual ledger (digital vs efectivo)
ALTER TABLE public.agent_balances
ADD COLUMN IF NOT EXISTS cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;
