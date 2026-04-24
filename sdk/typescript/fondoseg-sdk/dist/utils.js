export function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, '');
}
export function joinUrl(baseUrl, path) {
    return `${normalizeBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function createIdempotencyKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `fondoseg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
export function isRetryableStatus(status) {
    return status === 429 || status >= 500;
}
export function isProbablyNetworkError(error) {
    if (!(error instanceof Error))
        return false;
    return /network|fetch|timeout|timed out|socket|econnreset|etimedout/i.test(error.message);
}
