export class FondosEGError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FondosEGError';
    }
}
export class FondosEGApiError extends FondosEGError {
    constructor(input) {
        super(input.message);
        this.name = 'FondosEGApiError';
        this.status = input.status;
        this.code = input.code;
        this.requestId = input.requestId;
        this.details = input.details;
        this.data = input.data;
    }
}
export class FondosEGNetworkError extends FondosEGError {
    constructor(message, cause) {
        super(message);
        this.name = 'FondosEGNetworkError';
        this.cause = cause;
    }
}
export function isFondosEGApiFailure(value) {
    if (!value || typeof value !== 'object')
        return false;
    return ('success' in value &&
        value.success === false &&
        'error' in value);
}
export function toApiErrorPayload(value) {
    if (!isFondosEGApiFailure(value))
        return undefined;
    const error = value.error;
    if (!error || typeof error !== 'object')
        return undefined;
    if (typeof error.code !== 'string' || typeof error.message !== 'string')
        return undefined;
    return error;
}
