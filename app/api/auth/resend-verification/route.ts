import { NextResponse } from 'next/server';

import { resendVerificationEmail } from '@/app/actions/auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string; email?: string; name?: string };
    const result = await resendVerificationEmail(body.userId || '', body.email || '', body.name || '');
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Resend verification API error:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo reenviar el código. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
