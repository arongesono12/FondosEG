export declare function normalizeBaseUrl(baseUrl: string): string;
export declare function joinUrl(baseUrl: string, path: string): string;
export declare function sleep(ms: number): Promise<void>;
export declare function createIdempotencyKey(): string;
export declare function isRetryableStatus(status: number): boolean;
export declare function isProbablyNetworkError(error: unknown): boolean;
