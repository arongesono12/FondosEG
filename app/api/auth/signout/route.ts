import { NextResponse } from 'next/server';

import { signOutAction } from '@/app/actions/auth';

export async function POST() {
  try {
    const result = await signOutAction();
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Signout API error:', error);
    return NextResponse.json({ success: true });
  }
}
