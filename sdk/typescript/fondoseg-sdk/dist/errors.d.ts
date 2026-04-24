import type { FondosEGApiFailure, FondosEGErrorPayload } from './types';
export declare class FondosEGError extends Error {
    constructor(message: string);
}
export declare class FondosEGApiError extends FondosEGError {
    status: number;
    code?: string;
    requestId?: string;
    details?: unknown;
    data: unknown;
    constructor(input: {
        message: string;
        status: number;
        code?: string;
        requestId?: string;
        details?: unknown;
        data: unknown;
    });
}
export declare class FondosEGNetworkError extends FondosEGError {
    cause?: unknown;
    constructor(message: string, cause?: unknown);
}
export declare function isFondosEGApiFailure(value: unknown): value is FondosEGApiFailure;
export declare function toApiErrorPayload(value: unknown): FondosEGErrorPayload | undefined;
