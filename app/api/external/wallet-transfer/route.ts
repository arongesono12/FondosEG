import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { formatCurrency } from '@/lib/utils';

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    if (!await requirePermission(auth, 'transfer')) {
      return NextResponse.json({ error: 'Permiso denegado: transfer' }, { status: 403 });
    }

    const { user_id, role_access } = auth.apiKey!;
    
    if (role_access !== 'cliente') {
      return NextResponse.json(
        { error: 'Solo clientes pueden realizar transferencias entre billeteras' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      receiver_phone,
      receiver_name,
      amount,
      currency = 'XAF',
      notes,
    } = body;

    if (!receiver_phone || !amount || !receiver_name) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: receiver_phone, receiver_name, amount' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser mayor a 0' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: sender, error: senderError } = await adminClient
      .from('users')
      .select('*, client_balances(*)')
      .eq('id', user_id)
      .single();

    if (senderError || !sender) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 400 }
      );
    }

    if (sender.role !== 'cliente') {
      return NextResponse.json(
        { error: 'Solo clientes pueden usar transferencias de billetera' },
        { status: 403 }
      );
    }

    const { data: receiver, error: receiverError } = await adminClient
      .from('users')
      .select('*')
      .eq('phone', receiver_phone)
      .eq('role', 'cliente')
      .single();

    if (receiverError || !receiver) {
      return NextResponse.json(
        { error: 'El receptor no es un cliente válido o no existe' },
        { status: 400 }
      );
    }

    if (receiver.id === user_id) {
      return NextResponse.json(
        { error: 'No puedes transferirte a ti mismo' },
        { status: 400 }
      );
    }

    const senderBalance = (
      sender.client_balances as { id: string; currency: string; balance: number }[] | undefined
    )?.find((b) => b.currency === currency);

    if (!senderBalance) {
      return NextResponse.json(
        { error: 'Saldo insuficiente', current_balance: 0 },
        { status: 400 }
      );
    }

    const currentBalance = senderBalance.balance;

    if (currentBalance < amount) {
      return NextResponse.json(
        { error: 'Saldo insuficiente', current_balance: currentBalance },
        { status: 400 }
      );
    }

    const verificationCode = generateVerificationCode();

    const { data: transfer, error: transferError } = await adminClient
      .from('wallet_transfers')
      .insert({
        sender_id: user_id,
        receiver_id: receiver.id,
        sender_name: sender.name,
        sender_phone: sender.phone,
        receiver_name: receiver_name,
        receiver_phone: receiver_phone,
        amount: amount,
        currency: currency,
        verification_code: verificationCode,
        status: 'confirmed',
        notes: notes,
        confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (transferError) {
      return NextResponse.json(
        { error: transferError.message },
        { status: 500 }
      );
    }

    await adminClient
      .from('client_balances')
      .update({ balance: currentBalance - amount })
      .eq('id', senderBalance.id);

    const { data: receiverBalance } = await adminClient
      .from('client_balances')
      .select('*')
      .eq('client_id', receiver.id)
      .eq('currency', currency)
      .single();

    if (receiverBalance) {
      await adminClient
        .from('client_balances')
        .update({ balance: receiverBalance.balance + amount })
        .eq('id', receiverBalance.id);
    } else {
      await adminClient
        .from('client_balances')
        .insert({
          client_id: receiver.id,
          currency: currency,
          balance: amount,
        });
    }

    const notificationMessage = `Tienes una transferencia de ${formatCurrency(amount, currency)} de ${sender.name}.`;
    
    await adminClient
      .from('notifications')
      .insert({
        user_id: receiver.id,
        transfer_id: transfer.id,
        phone: receiver_phone,
        message: notificationMessage,
        status: 'pending',
        is_admin_notification: false,
        priority: 'high',
      });

    return NextResponse.json({
      success: true,
      data: {
        transfer_id: transfer.id,
        transfer_type: 'wallet',
        amount: amount,
        currency: currency,
        sender_name: sender.name,
        sender_phone: sender.phone,
        receiver_name: receiver_name,
        receiver_phone: receiver_phone,
        status: 'completed',
        created_at: transfer.created_at,
        new_balance: currentBalance - amount,
      },
    });

  } catch (error) {
    console.error('API Wallet Transfer Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

