import { NextRequest, NextResponse } from 'next/server';
import { developerSignUpAction } from '@/app/actions/developer-auth';
import { consumePublicEndpointRateLimit, isSameOriginMutation } from '@/lib/server/public-endpoint-security';
import type { RegisterFormData } from '@/types';

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const limit = await consumePublicEndpointRateLimit(request, 'developer-signup', 10, 60);
  if (!limit.allowed) return NextResponse.json({ success: false, error: 'Demasiados intentos de registro' }, { status: 429 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 16 * 1024) return NextResponse.json({ success: false, error: 'Payload demasiado grande' }, { status: 413 });
  try {
    const result = await developerSignUpAction(JSON.parse(raw) as RegisterFormData);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, error: 'No se pudo procesar el registro' }, { status: 400 });
  }
}
