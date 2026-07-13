import { NextResponse } from 'next/server';

import { verifyEmailCode } from '@/app/actions/auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string; email?: string; code?: string };
    const result = await verifyEmailCode(body.userId || '', body.email || '', body.code || '');
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Verify email API error:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo verificar el código. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
