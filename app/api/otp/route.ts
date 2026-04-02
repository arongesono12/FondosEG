import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOTPEmail } from '@/lib/email-service';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_EXPIRY_MINUTES = 15;
const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId, name, action } = body;

    if (!email || !userId) {
      return NextResponse.json(
        { error: 'Email y userId son requeridos' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    if (action === 'resend') {
      const { data: existing } = await adminClient
        .from('email_verification')
        .select('*')
        .eq('user_id', userId)
        .is('verified_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existing && new Date(existing.expires_at) > new Date()) {
        return NextResponse.json(
          { error: 'Ya existe un código activo. Espera a que expire o usa el código actual.' },
          { status: 400 }
        );
      }
    }

    await adminClient
      .from('email_verification')
      .update({ verified_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('verified_at', null);

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const { error: insertError } = await adminClient
      .from('email_verification')
      .insert({
        email: email.toLowerCase(),
        code,
        user_id: userId,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error inserting OTP:', insertError);
      return NextResponse.json(
        { error: 'Error al generar el código' },
        { status: 500 }
      );
    }

    const emailResult = await sendOTPEmail({
      to: email,
      name: name || 'Usuario',
      code,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Error al enviar el correo. Verifica que el email sea válido.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Código enviado correctamente',
      expiresIn: OTP_EXPIRY_MINUTES * 60,
    });

  } catch (error) {
    console.error('OTP Generation Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, userId } = body;

    if (!email || !code || !userId) {
      return NextResponse.json(
        { error: 'Email, código y userId son requeridos' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: verification, error: findError } = await adminClient
      .from('email_verification')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code)
      .eq('email', email.toLowerCase())
      .is('verified_at', null)
      .single();

    if (findError || !verification) {
      return NextResponse.json(
        { error: 'Código inválido o expirado' },
        { status: 400 }
      );
    }

    if (verification.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Solicita un nuevo código.' },
        { status: 400 }
      );
    }

    if (new Date(verification.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'El código ha expirado. Solicita uno nuevo.' },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from('email_verification')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Error al verificar el código' },
        { status: 500 }
      );
    }

    const { error: userUpdateError } = await adminClient
      .from('users')
      .update({ is_verified: true })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error updating user verification:', userUpdateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Email verificado correctamente',
    });

  } catch (error) {
    console.error('OTP Verification Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId y email son requeridos' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: verification, error } = await adminClient
      .from('email_verification')
      .select('*')
      .eq('user_id', userId)
      .eq('email', email.toLowerCase())
      .is('verified_at', null)
      .single();

    if (error || !verification) {
      return NextResponse.json({ verified: false });
    }

    const isExpired = new Date(verification.expires_at) < new Date();
    const remainingAttempts = MAX_ATTEMPTS - verification.attempts;

    return NextResponse.json({
      verified: false,
      expiresAt: verification.expires_at,
      isExpired,
      remainingAttempts,
      attempts: verification.attempts,
    });

  } catch (error) {
    console.error('OTP Status Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
