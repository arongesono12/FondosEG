import { NextRequest, NextResponse } from 'next/server';

import { signUpAction } from '@/app/actions/auth';
import type { RegisterFormData } from '@/types';
import { consumePublicEndpointRateLimit, isSameOriginMutation } from '@/lib/server/public-endpoint-security';

const MAX_SIGNUP_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginMutation(request)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const rateLimit = await consumePublicEndpointRateLimit(request, 'public-signup', 10, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiados intentos de registro' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_SIGNUP_BYTES) {
      return NextResponse.json({ success: false, error: 'Payload demasiado grande' }, { status: 413 });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_SIGNUP_BYTES) {
      return NextResponse.json({ success: false, error: 'Payload demasiado grande' }, { status: 413 });
    }
    const body = JSON.parse(rawBody) as RegisterFormData;
    const result = await signUpAction(body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo procesar el registro. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
