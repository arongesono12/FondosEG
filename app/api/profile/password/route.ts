import { NextResponse } from 'next/server';
import { updatePasswordAction } from '@/app/actions/profile';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await updatePasswordAction(formData);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Password update API error:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo actualizar la contraseña.' },
      { status: 500 }
    );
  }
}
