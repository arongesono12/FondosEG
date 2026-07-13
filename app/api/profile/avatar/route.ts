import { NextResponse } from 'next/server';
import { uploadAvatarAction } from '@/app/actions/profile';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await uploadAvatarAction(formData);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Avatar upload API error:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo actualizar el avatar.' },
      { status: 500 }
    );
  }
}
