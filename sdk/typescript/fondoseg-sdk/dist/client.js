import { FondosEGApiError, FondosEGNetworkError, isFondosEGApiFailure, toApiErrorPayload } from './errors';
import { createIdempotencyKey, isProbablyNetworkError, isRetryableStatus, joinUrl, sleep } from './utils';
export class FondosEGClient {
    constructor(options) {
        if (!options.baseUrl)
            throw new Error('baseUrl is required');
        if (!options.apiKey)
            throw new Error('apiKey is required');
        if (!options.apiSecret)
            throw new Error('apiSecret is required');
        if (!options.fetch && typeof fetch !== 'function') {
            throw new Error('A fetch implementation is required in this runtime');
        }
        this.baseUrl = options.baseUrl;
        this.apiKey = options.apiKey;
        this.apiSecret = options.apiSecret;
        this.timeoutMs = options.timeoutMs ?? 15000;
        this.retries = options.retries ?? 2;
        this.retryDelayMs = options.retryDelayMs ?? 500;
        this.fetchImpl = options.fetch ?? fetch;
        this.userAgent = options.userAgent;
    }
    async getBalance(options) {
        return this.request('/api/external/balance', {
            method: 'GET',
            signal: options?.signal,
        });
    }
    async getHistory(params = {}, options) {
        const search = new URLSearchParams();
        if (typeof params.limit === 'number')
            search.set('limit', String(params.limit));
        if (typeof params.offset === 'number')
            search.set('offset', String(params.offset));
        const path = `/api/external/history${search.toString() ? `?${search.toString()}` : ''}`;
        return this.request(path, {
            method: 'GET',
            signal: options?.signal,
        });
    }
    async createTransfer(input, options) {
        return this.request('/api/external/transfer', {
            method: 'POST',
            body: input,
            idempotencyKey: options?.idempotencyKey ?? createIdempotencyKey(),
            signal: options?.signal,
        });
    }
    async createWalletTransfer(input, options) {
        return this.request('/api/external/wallet-transfer', {
            method: 'POST',
            body: input,
            idempotencyKey: options?.idempotencyKey ?? createIdempotencyKey(),
            signal: options?.signal,
        });
    }
    async request(path, init) {
        const url = joinUrl(this.baseUrl, path);
        for (let attempt = 0; attempt <= this.retries; attempt += 1) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
            const signal = this.mergeSignals(controller.signal, init.signal);
            try {
                const headers = {
                    'x-api-key': this.apiKey,
                    'x-api-secret': this.apiSecret,
                    'accept': 'application/json',
                };
                if (this.userAgent) {
                    headers['user-agent'] = this.userAgent;
                }
                if (init.body !== undefined) {
                    headers['content-type'] = 'application/json';
                }
                if (init.idempotencyKey) {
                    headers['idempotency-key'] = init.idempotencyKey;
                }
                const response = await this.fetchImpl(url, {
                    method: init.method,
                    headers,
                    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
                    signal,
                });
                const payload = (await response.json().catch(() => null));
                if (!response.ok) {
                    const apiError = toApiErrorPayload(payload);
                    const error = new FondosEGApiError({
                        message: apiError?.message ?? `FondosEG request failed with status ${response.status}`,
                        status: response.status,
                        code: apiError?.code,
                        requestId: payload && typeof payload === 'object' && 'request_id' in payload
                            ? String(payload.request_id || '')
                            : undefined,
                        details: apiError?.details,
                        data: payload,
                    });
                    if (attempt < this.retries && isRetryableStatus(response.status)) {
                        await sleep(this.retryDelayMs * (attempt + 1));
                        continue;
                    }
                    throw error;
                }
                if (isFondosEGApiFailure(payload)) {
                    throw new FondosEGApiError({
                        message: payload.error.message,
                        status: response.status,
                        code: payload.error.code,
                        requestId: payload.request_id,
                        details: payload.error.details,
                        data: payload,
                    });
                }
                return payload;
            }
            catch (error) {
                if (attempt < this.retries &&
                    ((error instanceof FondosEGApiError && isRetryableStatus(error.status)) ||
                        isProbablyNetworkError(error))) {
                    await sleep(this.retryDelayMs * (attempt + 1));
                    continue;
                }
                if (error instanceof FondosEGApiError) {
                    throw error;
                }
                if (error instanceof Error && error.name === 'AbortError') {
                    throw new FondosEGNetworkError(`FondosEG request timed out after ${this.timeoutMs}ms`, error);
                }
                throw new FondosEGNetworkError('FondosEG request failed due to a network error', error);
            }
            finally {
                clearTimeout(timeout);
            }
        }
        throw new FondosEGNetworkError('FondosEG request exhausted all retries');
    }
    mergeSignals(timeoutSignal, userSignal) {
        if (!userSignal)
            return timeoutSignal;
        if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
            return AbortSignal.any([timeoutSignal, userSignal]);
        }
        const controller = new AbortController();
        const abort = () => controller.abort();
        timeoutSignal.addEventListener('abort', abort);
        userSignal.addEventListener('abort', abort);
        return controller.signal;
    }
}
