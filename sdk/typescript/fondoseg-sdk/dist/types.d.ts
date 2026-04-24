export type FondosEGErrorCode = 'authentication_required' | 'invalid_credentials' | 'rate_limit_exceeded' | 'permission_denied' | 'validation_error' | 'idempotency_conflict' | 'not_found' | 'business_rule_failed' | 'internal_error';
export type FondosEGRole = 'admin' | 'superadmin' | 'gestor' | 'cliente';
export interface FondosEGErrorPayload {
    code: FondosEGErrorCode;
    message: string;
    details?: unknown;
}
export interface FondosEGApiSuccess<T> {
    success: true;
    data: T;
    request_id: string;
}
export interface FondosEGApiFailure {
    success: false;
    error: FondosEGErrorPayload;
    request_id?: string;
}
export interface BalanceData {
    role: FondosEGRole;
    balance: number;
    cash_balance?: number;
    total_balance?: number;
    currency: string;
}
export interface CreateAgentTransferInput {
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
    currency?: string;
    notes?: string;
}
export interface AgentTransferData {
    transfer_id: string;
    transfer_code: string;
    amount: number;
    currency: string;
    receiver_name: string;
    receiver_phone: string;
    destination_city: string;
    status: string;
    created_at: string;
}
export interface CreateWalletTransferInput {
    receiver_phone: string;
    receiver_name: string;
    amount: number;
    currency?: string;
    notes?: string;
}
export interface WalletTransferData {
    transfer_id: string;
    transfer_type: 'wallet';
    amount: number;
    currency: string;
    sender_name: string;
    sender_phone: string;
    receiver_name: string;
    receiver_phone: string;
    status: string;
    created_at: string;
    new_balance: number;
}
export interface HistoryItem {
    [key: string]: unknown;
}
export interface GetHistoryParams {
    limit?: number;
    offset?: number;
}
export interface HistoryResponseSuccess extends FondosEGApiSuccess<HistoryItem[]> {
    pagination?: {
        limit: number;
        offset: number;
    };
}
export interface RequestOptions {
    idempotencyKey?: string;
    signal?: AbortSignal;
}
export interface RetryOptions {
    retries?: number;
    retryDelayMs?: number;
}
export interface FondosEGClientOptions extends RetryOptions {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    userAgent?: string;
}
export interface TransferCreatedWebhookData {
    transfer_id: string;
    transfer_code: string;
    amount: number;
    currency: string;
    status: string;
    sender_name: string;
    sender_phone: string;
    receiver_name: string;
    receiver_phone: string;
    destination_city: string;
    destination_country?: string | null;
    source?: string;
}
export interface TransferPaidOutWebhookData {
    transfer_id: string;
    transfer_code: string;
    amount: number;
    currency: string;
    status: string;
    sender_name?: string | null;
    sender_phone?: string | null;
    receiver_name?: string | null;
    receiver_phone?: string | null;
    destination_city?: string | null;
    paid_out_at?: string | null;
    paid_out_by?: string | null;
    source?: string;
}
export interface WalletTransferConfirmedWebhookData {
    transfer_id: string;
    amount: number;
    currency: string;
    status: string;
    sender_name?: string | null;
    sender_phone?: string | null;
    receiver_name: string;
    receiver_phone?: string | null;
    confirmed_at?: string | null;
    source?: string;
}
export type FondosEGWebhookEvent = 'transfer.created' | 'transfer.paid_out' | 'wallet_transfer.confirmed';
export interface FondosEGWebhookEnvelopeMap {
    'transfer.created': TransferCreatedWebhookData;
    'transfer.paid_out': TransferPaidOutWebhookData;
    'wallet_transfer.confirmed': WalletTransferConfirmedWebhookData;
}
export interface FondosEGWebhookEnvelope<TEvent extends FondosEGWebhookEvent = FondosEGWebhookEvent> {
    id: string;
    event: TEvent;
    created_at: string;
    data: FondosEGWebhookEnvelopeMap[TEvent];
}
export interface FondosEGWebhookHeaders {
    id: string;
    event: FondosEGWebhookEvent;
    timestamp: string;
    signature: string;
}
