/**
 * app/api/otp/route.ts
 *
 * HTTP API endpoint for OTP operations.
 * Now delegates all business logic to lib/server/otp-service.ts.
 * This route is kept for external integrations or mobile clients that can't
 * use Server Actions. The dashboard uses Server Actions directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAndSendOTP, verifyOTP, getOTPStatus } from '@/lib/server/otp-service';

// POST /api/otp — generate & send a new OTP code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId, name, action } = body as {
      email: string;
      userId: string;
      name?: string;
      action?: string;
    };

    if (!email || !userId) {
      return NextResponse.json(
        { error: 'email y userId son requeridos' },
        { status: 400 },
      );
    }

    const isResend = action === 'resend';
    const result   = await generateAndSendOTP(userId, email, name ?? 'Usuario', isResend);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success:   true,
      message:   'Código enviado correctamente',
      expiresIn: result.expiresIn,
    });

  } catch (error) {
    console.error('[/api/otp POST] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

// PUT /api/otp — verify a submitted OTP code
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, userId } = body as {
      email: string;
      code: string;
      userId: string;
    };

    if (!email || !code || !userId) {
      return NextResponse.json(
        { error: 'email, código y userId son requeridos' },
        { status: 400 },
      );
    }

    const result = await verifyOTP(userId, email, code);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Email verificado correctamente',
    });

  } catch (error) {
    console.error('[/api/otp PUT] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

// GET /api/otp?userId=...&email=... — query OTP status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ?? '';
    const email  = searchParams.get('email')  ?? '';

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId y email son requeridos' },
        { status: 400 },
      );
    }

    const status = await getOTPStatus(userId, email);

    if (!status) {
      return NextResponse.json({ verified: false });
    }

    return NextResponse.json({ verified: false, ...status });

  } catch (error) {
    console.error('[/api/otp GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
