import { NextResponse } from 'next/server';
import { updateProfileAction } from '@/app/actions/profile';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await updateProfileAction(formData);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Profile update API error:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo guardar el perfil.' },
      { status: 500 }
    );
  }
}
