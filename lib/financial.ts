export type TransferLifecycleStatus =
  | 'created'
  | 'available_for_pickup'
  | 'paid_out'
  | 'completed'
  | 'cancelled';

export interface TariffRange {
  min: number;
  max: number;
  commission: number;
  ruleCode?: string;
  version?: string;
}

export const BASE_CURRENCY = 'XAF';
export const NATIONAL_TARIFF_VERSION = '2026-default';
export const ESTIMATED_OPERATING_COST_PER_TRANSFER = 200;

export const nationalTariffs: TariffRange[] = [
  { min: 1000, max: 20000, commission: 500, ruleCode: 'agent-transfer-001', version: NATIONAL_TARIFF_VERSION },
  { min: 20001, max: 50000, commission: 1000, ruleCode: 'agent-transfer-002', version: NATIONAL_TARIFF_VERSION },
  { min: 50001, max: 85000, commission: 2000, ruleCode: 'agent-transfer-003', version: NATIONAL_TARIFF_VERSION },
  { min: 85001, max: 160000, commission: 2500, ruleCode: 'agent-transfer-004', version: NATIONAL_TARIFF_VERSION },
  { min: 160001, max: 250000, commission: 3000, ruleCode: 'agent-transfer-005', version: NATIONAL_TARIFF_VERSION },
  { min: 250001, max: 350000, commission: 3500, ruleCode: 'agent-transfer-006', version: NATIONAL_TARIFF_VERSION },
  { min: 350001, max: 400000, commission: 4000, ruleCode: 'agent-transfer-007', version: NATIONAL_TARIFF_VERSION },
  { min: 400001, max: 500000, commission: 6000, ruleCode: 'agent-transfer-008', version: NATIONAL_TARIFF_VERSION },
  { min: 500001, max: 750000, commission: 7000, ruleCode: 'agent-transfer-009', version: NATIONAL_TARIFF_VERSION },
  { min: 750001, max: 900000, commission: 9000, ruleCode: 'agent-transfer-010', version: NATIONAL_TARIFF_VERSION },
  { min: 900001, max: 1200000, commission: 11000, ruleCode: 'agent-transfer-011', version: NATIONAL_TARIFF_VERSION },
  { min: 1200001, max: 1500000, commission: 16000, ruleCode: 'agent-transfer-012', version: NATIONAL_TARIFF_VERSION },
  { min: 1500001, max: 2000000, commission: 18000, ruleCode: 'agent-transfer-013', version: NATIONAL_TARIFF_VERSION },
];

export function calculateCommission(amount: number): number {
  const tariff = getTariffInfo(amount);
  return tariff?.commission ?? 0;
}

export function getTariffInfo(amount: number): TariffRange | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  for (const tariff of nationalTariffs) {
    if (amount >= tariff.min && amount <= tariff.max) {
      return tariff;
    }
  }

  return null;
}

export function normalizeTransferStatus(status?: string | null): TransferLifecycleStatus {
  switch (status) {
    case 'available_for_pickup':
      return 'available_for_pickup';
    case 'paid_out':
      return 'paid_out';
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'expired':
      return 'cancelled';
    case 'pending':
    case 'created':
      return 'created';
    default:
      return 'created';
  }
}

export function getTransferStatusLabel(status?: string | null): string {
  switch (normalizeTransferStatus(status)) {
    case 'available_for_pickup':
      return 'Disponible';
    case 'paid_out':
    case 'completed':
      return 'Pagada';
    case 'cancelled':
      return 'Cancelada';
    default:
      return 'Creada';
  }
}

export function isTransferCompleted(status?: string | null): boolean {
  const normalized = normalizeTransferStatus(status);
  return normalized === 'paid_out' || normalized === 'completed';
}

export function isTransferPending(status?: string | null): boolean {
  const normalized = normalizeTransferStatus(status);
  return normalized === 'created' || normalized === 'available_for_pickup';
}

export function mapWalletTransferStatus(status?: string | null): TransferLifecycleStatus {
  if (status === 'confirmed') return 'completed';
  if (status === 'cancelled' || status === 'expired') return 'cancelled';
  return 'created';
}

export function getAvailableClientBalance(balance: number, reservedBalance: number = 0): number {
  return Math.max(Number(balance || 0) - Number(reservedBalance || 0), 0);
}

export function estimateProjectedTopups24h(
  averageDailyOutflow: number,
  currentAvailableFloat: number,
  safetyBufferRatio: number = 0.15
): number {
  const safeTarget = Math.max(averageDailyOutflow * (1 + safetyBufferRatio), 0);
  return Math.max(safeTarget - Math.max(currentAvailableFloat, 0), 0);
}

export function estimateLiquidityCoverageDays(
  currentAvailableFloat: number,
  averageDailyOutflow: number
): number {
  if (averageDailyOutflow <= 0) {
    return 0;
  }

  return Number((Math.max(currentAvailableFloat, 0) / averageDailyOutflow).toFixed(2));
}

export function estimateFloatUtilization(totalReserved: number, totalAvailable: number): number {
  const denominator = Math.max(Number(totalReserved || 0) + Number(totalAvailable || 0), 0);
  if (!denominator) return 0;
  return Math.round((Math.max(Number(totalReserved || 0), 0) / denominator) * 100);
}

export function estimateOperatingCost(transferCount: number, perTransfer: number = ESTIMATED_OPERATING_COST_PER_TRANSFER): number {
  return Math.max(Number(transferCount || 0), 0) * Math.max(Number(perTransfer || 0), 0);
}

