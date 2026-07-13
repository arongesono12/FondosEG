import { NextResponse } from 'next/server';

import { signUpAction } from '@/app/actions/auth';
import type { RegisterFormData } from '@/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterFormData;
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
