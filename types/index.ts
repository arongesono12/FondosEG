export type UserRole = 'admin' | 'superadmin' | 'gestor' | 'cliente';
export type TransferStatus = 'created' | 'available_for_pickup' | 'paid_out' | 'completed' | 'cancelled';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  document_type?: string;
  document_number?: string;
  country?: string;
  city?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentBalance {
  id: string;
  agent_id: string;
  balance: number;
  cash_balance?: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface ClientBalance {
  id: string;
  client_id: string;
  balance: number;
  reserved_balance?: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transfer {
  id: string;
  transfer_code: string;
  transfer_type?: 'agent' | 'client';
  agent_id?: string;
  sender_id?: string;
  receiver_user_id?: string;
  sender_name: string;
  sender_phone: string;
  sender_document_type?: string;
  sender_document_number?: string;
  receiver_name: string;
  receiver_phone: string;
  destination_city: string;
  destination_country?: string;
  amount: number;
  currency: string;
  status: TransferStatus;
  notes?: string;
  commission_amount?: number;
  pricing_rule_code?: string;
  available_at?: string;
  paid_out_at?: string;
  wallet_credited_at?: string;
  wallet_debited_at?: string;
  created_at: string;
  completed_at?: string;
  cancelled_at?: string;
  agent?: {
    name: string;
    phone?: string;
  };
  sender?: {
    name: string;
    phone?: string;
  };
}

export interface BalanceTransaction {
  id: string;
  agent_id: string;
  type: 'topup' | 'transfer' | 'refund' | 'commission';
  amount: number;
  previous_balance: number;
  new_balance: number;
  reference_id?: string;
  reference_type?: string;
  description?: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id?: string;
  transfer_id?: string;
  phone: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  twilio_sid?: string;
  error_message?: string;
  created_at: string;
  sent_at?: string;
  is_read?: boolean;
  read_at?: string;
  is_admin_notification?: boolean;
  priority?: 'normal' | 'high';
}

export interface AgentWithBalance extends User {
  balance: number;
  cash_balance?: number;
  topup_total?: number;
  last_topup_at?: string;
}

export interface DailyTransferStats {
  date: string;
  transfer_count: number;
  total_amount: number;
  agent_count: number;
}

export interface AgentTransferStats {
  agent_id: string;
  agent_name: string;
  transfer_count: number;
  total_sent: number;
  last_transfer: string;
}

export interface AgentCommissionStat {
  agent_id: string;
  agent_name: string;
  total_commission: number;
  today_commission: number;
  month_commission: number;
  year_commission: number;
  transfer_count: number;
  estimated_cost: number;
  net_profit: number;
  net_margin: number;
}

export interface AgentsCommissionStats {
  agents: AgentCommissionStat[];
  totalCommission: number;
  todayCommission: number;
  monthCommission: number;
  yearCommission: number;
  totalEstimatedCost: number;
  totalNetProfit: number;
  averageNetMargin: number;
}

export interface ReconciliationPeriodSummary {
  period: string;
  topups: number;
  transfersOutflow: number;
  refunds: number;
  resets: number;
  netFlow: number;
  transactionCount: number;
}

export interface ReconciliationSummary {
  periods: ReconciliationPeriodSummary[];
  totalNetFlow: number;
}

export interface TransferFormData {
  sender_name: string;
  sender_phone: string;
  sender_document_type?: string;
  sender_document_number?: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_document_type?: string;
  receiver_document_number?: string;
  destination_city: string;
  destination_country?: string;
  amount: number;
  currency: string;
  notes?: string;
}

export interface ClientTransferFormData {
  receiver_name: string;
  receiver_phone: string;
  destination_city: string;
  destination_country?: string;
  amount: number;
  currency: string;
  notes?: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  document_type?: string;
  document_number?: string;
  country?: string;
  city?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface DashboardStats {
  totalBalance: number;
  availableBalance?: number;
  reservedBalance?: number;
  pendingExposure?: number;
  todayTransfers: number;
  totalSent: number;
  totalClients: number;
  balancesByCurrency?: Record<string, number>;
  totalCommission: number;
  todayCommission: number;
  monthlyCommission?: number;
  yearlyCommission?: number;
  commissionPerTransfer: number;
  averageTicket?: number;
  todayVolume?: number;
  weeklyVolume?: number;
  monthlyVolume?: number;
  settlementRate?: number;
  activeAgents?: number;
  agentsBelowThreshold?: number;
  projectedTopups24h?: number;
  liquidityCoverageDays?: number;
  floatUtilization?: number;
  pickupReadyTransfers?: number;
  pickupReadyAmount?: number;
  completedTransfers: number;
  pendingTransfers: number;
  cancelledTransfers: number;
}

export interface ChartData {
  name: string;
  value: number;
}

export interface WalletTransfer {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  amount: number;
  currency: string;
  verification_code: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  notes?: string;
  expires_at?: string;
  reserved_at?: string;
  created_at: string;
  confirmed_at?: string;
  sender?: {
    name: string;
    phone?: string;
  };
  receiver?: {
    name: string;
    phone?: string;
  };
}

export interface CreateWalletTransferData {
  receiver_phone: string;
  receiver_name: string;
  amount: number;
  currency: string;
  notes?: string;
}

export interface ConfirmWalletTransferData {
  transfer_id: string;
  verification_code: string;
}

export type ApiPermission = 'balance' | 'transfer' | 'history';

export interface ApiKeyRecord {
  id: string;
  app_name: string;
  app_description?: string;
  api_key: string;
  api_secret_preview?: string;
  role_access: UserRole;
  permissions: Record<ApiPermission, boolean>;
  is_active: boolean;
  rate_limit: number;
  rate_limit_window_minutes?: number;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface CreateApiKeyData {
  app_name: string;
  app_description?: string;
  role_access: UserRole;
  permissions: Record<ApiPermission, boolean>;
}

export interface CreatedApiKeyResponse {
  success: boolean;
  apiKey: ApiKeyRecord & {
    api_secret: string;
  };
}

export interface RotateApiKeyResponse {
  success: boolean;
  apiKey: ApiKeyRecord & {
    api_secret: string;
  };
}

export interface ApiRequestLog {
  id: string;
  api_key_id: string;
  request_id: string;
  method: string;
  path: string;
  status_code: number;
  error_code?: string;
  latency_ms: number;
  created_at: string;
}

export interface ApiUsageResponse {
  logs: ApiRequestLog[];
  summary: {
    total: number;
    success: number;
    errors: number;
  };
}
