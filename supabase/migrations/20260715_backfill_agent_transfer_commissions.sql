BEGIN;

-- Ensure agent transfer tariff rules exist in production databases where older
-- migrations may have been applied partially.
INSERT INTO public.financial_pricing_rules (product_code, version, rule_code, currency, min_amount, max_amount, commission_amount)
VALUES
  ('agent_transfer', '2026-default', 'agent-transfer-001', 'XAF', 1000, 20000, 500),
  ('agent_transfer', '2026-default', 'agent-transfer-002', 'XAF', 20001, 50000, 1000),
  ('agent_transfer', '2026-default', 'agent-transfer-003', 'XAF', 50001, 85000, 2000),
  ('agent_transfer', '2026-default', 'agent-transfer-004', 'XAF', 85001, 160000, 2500),
  ('agent_transfer', '2026-default', 'agent-transfer-005', 'XAF', 160001, 250000, 3000),
  ('agent_transfer', '2026-default', 'agent-transfer-006', 'XAF', 250001, 350000, 3500),
  ('agent_transfer', '2026-default', 'agent-transfer-007', 'XAF', 350001, 400000, 4000),
  ('agent_transfer', '2026-default', 'agent-transfer-008', 'XAF', 400001, 500000, 6000),
  ('agent_transfer', '2026-default', 'agent-transfer-009', 'XAF', 500001, 750000, 7000),
  ('agent_transfer', '2026-default', 'agent-transfer-010', 'XAF', 750001, 900000, 9000),
  ('agent_transfer', '2026-default', 'agent-transfer-011', 'XAF', 900001, 1200000, 11000),
  ('agent_transfer', '2026-default', 'agent-transfer-012', 'XAF', 1200001, 1500000, 16000),
  ('agent_transfer', '2026-default', 'agent-transfer-013', 'XAF', 1500001, 2000000, 18000)
ON CONFLICT (rule_code) DO UPDATE
SET
  product_code = EXCLUDED.product_code,
  version = EXCLUDED.version,
  currency = EXCLUDED.currency,
  min_amount = EXCLUDED.min_amount,
  max_amount = EXCLUDED.max_amount,
  commission_amount = EXCLUDED.commission_amount,
  is_active = TRUE,
  updated_at = NOW();

-- Backfill transfers created while pricing rules/RPC commission calculation
-- were missing or returned zero.
UPDATE public.transfers
SET
  commission_amount = public.calculate_tariff_commission(amount),
  pricing_rule_code = public.calculate_tariff_rule_code(amount)
WHERE transfer_type = 'agent'
  AND COALESCE(commission_amount, 0) = 0
  AND COALESCE(status, 'created') <> 'cancelled'
  AND public.calculate_tariff_commission(amount) > 0;

COMMIT;
