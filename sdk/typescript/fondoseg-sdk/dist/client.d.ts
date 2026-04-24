import type { AgentTransferData, BalanceData, CreateAgentTransferInput, CreateWalletTransferInput, FondosEGApiSuccess, FondosEGClientOptions, GetHistoryParams, HistoryResponseSuccess, RequestOptions, WalletTransferData } from './types';
export declare class FondosEGClient {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly apiSecret;
    private readonly timeoutMs;
    private readonly retries;
    private readonly retryDelayMs;
    private readonly fetchImpl;
    private readonly userAgent?;
    constructor(options: FondosEGClientOptions);
    getBalance(options?: RequestOptions): Promise<FondosEGApiSuccess<BalanceData>>;
    getHistory(params?: GetHistoryParams, options?: RequestOptions): Promise<HistoryResponseSuccess>;
    createTransfer(input: CreateAgentTransferInput, options?: RequestOptions): Promise<FondosEGApiSuccess<AgentTransferData>>;
    createWalletTransfer(input: CreateWalletTransferInput, options?: RequestOptions): Promise<FondosEGApiSuccess<WalletTransferData>>;
    private request;
    private mergeSignals;
}
