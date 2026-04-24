import type { FondosEGWebhookEnvelope, FondosEGWebhookEvent, FondosEGWebhookHeaders } from './types';
export declare function signFondosEGWebhookPayload(input: {
    signingSecret: string;
    timestamp: string;
    rawBody: string;
}): string;
export declare function verifyFondosEGWebhookSignature(input: {
    signingSecret: string;
    timestamp: string;
    rawBody: string;
    signature: string;
    toleranceSeconds?: number;
    now?: Date;
}): boolean;
export declare function parseFondosEGWebhookHeaders(headers: Headers | Record<string, string | string[] | undefined>): FondosEGWebhookHeaders;
export declare function parseFondosEGWebhookBody<TEvent extends FondosEGWebhookEvent = FondosEGWebhookEvent>(rawBody: string): FondosEGWebhookEnvelope<TEvent>;
