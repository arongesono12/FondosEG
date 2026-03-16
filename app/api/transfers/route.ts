import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import type { Transfer, TransferFormData } from '@/types';
import { generateTransferCode } from '@/lib/utils';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip');
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('237')) return `+${cleaned}`;
  if (cleaned.startsWith('6') && cleaned.length === 9) return `+237${cleaned}`;
  if (phone.trim().startsWith('+')) return phone.trim();
  return `+${cleaned}`;
}

async function saveNotification(
  supabaseAdmin: any,
  transferId: string,
  phone: string,
  message: string,
  status: 'sent' | 'failed',
  twilioSid?: string,
  errorMessage?: string
) {
  try {
    await supabaseAdmin.from('notifications').insert({
      transfer_id: transferId,
      phone,
      message,
      status,
      twilio_sid: twilioSid || null,
      error_message: errorMessage || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error('Error saving notification:', err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    if (profile.role === 'admin') {
      const { data, error } = await adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name, phone)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    if (profile.role === 'gestor') {
      const { data, error } = await adminClient
        .from('transfers')
        .select('*')
        .eq('agent_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return NextResponse.json((data || []) as Transfer[]);
    }

    // cliente: show own client transfers + wallet transfers mapped to Transfer
    const { data: clientTransfers } = await adminClient
      .from('transfers')
      .select('*')
      .eq('sender_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: walletTransfers } = await adminClient
      .from('wallet_transfers')
      .select('*')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    const mappedWallet: Transfer[] = (walletTransfers || []).map((t: any) => ({
      id: t.id,
      transfer_code: `WT-${String(t.id).slice(0, 8)}`,
      transfer_type: 'client',
      sender_id: t.sender_id,
      sender_name: t.sender_name,
      sender_phone: t.sender_phone,
      receiver_name: t.receiver_name,
      receiver_phone: t.receiver_phone,
      destination_city: 'Billetera',
      destination_country: '',
      amount: Number(t.amount),
      currency: t.currency || 'XAF',
      status: t.status === 'confirmed' ? 'completed' : t.status === 'pending' ? 'created' : 'cancelled',
      notes: t.notes || undefined,
      created_at: t.created_at,
      completed_at: t.confirmed_at || undefined,
      cancelled_at: t.cancelled_at || undefined,
    }));

    const all = ([...(clientTransfers || []), ...mappedWallet] as Transfer[]).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json(all.slice(0, limit));
  } catch (err) {
    console.error('[GET /api/transfers]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminClient = createAdminClient();

  try {
    const profile = await requireProfile();
    requireRole(profile, 'gestor');

    const body = (await request.json()) as TransferFormData;
    if (!body.receiver_name || !body.receiver_phone || !body.amount || !body.destination_city) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const { data: balance, error: balanceError } = await adminClient
      .from('agent_balances')
      .select('balance')
      .eq('agent_id', profile.id)
      .single();

    if (balanceError || !balance) {
      return NextResponse.json({ success: false, error: 'No se encontró el saldo del gestor' }, { status: 400 });
    }

    if (Number(balance.balance) < Number(body.amount)) {
      return NextResponse.json({ success: false, error: 'Saldo insuficiente para realizar la transferencia' }, { status: 400 });
    }

    const transferCode = generateTransferCode();
    const nowIso = new Date().toISOString();

    const { data: transfer, error: transferError } = await adminClient
      .from('transfers')
      .insert({
        transfer_code: transferCode,
        transfer_type: 'agent',
        agent_id: profile.id,
        sender_name: body.sender_name,
        sender_phone: body.sender_phone,
        sender_document_type: body.sender_document_type,
        sender_document_number: body.sender_document_number,
        receiver_name: body.receiver_name,
        receiver_phone: body.receiver_phone,
        receiver_document_type: body.receiver_document_type,
        receiver_document_number: body.receiver_document_number,
        destination_city: body.destination_city,
        destination_country: body.destination_country,
        amount: body.amount,
        currency: body.currency,
        status: 'completed',
        notes: body.notes,
        completed_at: nowIso,
      })
      .select()
      .single();

    if (transferError || !transfer) {
      return NextResponse.json({ success: false, error: transferError?.message || 'Error creando transferencia' }, { status: 500 });
    }

    const previousBalance = Number(balance.balance) || 0;
    const newBalance = previousBalance - Number(body.amount);

    await adminClient
      .from('agent_balances')
      .update({ balance: newBalance, updated_at: nowIso })
      .eq('agent_id', profile.id);

    await adminClient.from('balance_transactions').insert({
      agent_id: profile.id,
      type: 'transfer',
      amount: -Number(body.amount),
      previous_balance: previousBalance,
      new_balance: newBalance,
      reference_id: transfer.id,
      reference_type: 'transfer',
      description: `Transferencia: ${transferCode}`,
    });

    await adminClient.from('activity_logs').insert({
      user_id: profile.id,
      action: 'create_transfer',
      entity_type: 'transfer',
      entity_id: transfer.id,
      metadata: { transfer_code: transferCode, amount: body.amount },
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent'),
    });

    // Send SMS from the server (never from the browser).
    const senderMessage = `SendDirect: Su transferencia de ${transfer.amount} ${transfer.currency} ha sido registrada correctamente.\n\nRemitente: ${transfer.sender_name}\nDestinatario: ${transfer.receiver_name}\nMonto: ${transfer.amount} ${transfer.currency}\nCódigo: ${transfer.transfer_code}\n\nGracias por confiar en SendDirect.`;
    const receiverMessage = `SendDirect: Tiene una transferencia disponible de ${transfer.amount} ${transfer.currency} de ${transfer.sender_name}.\n\nCiudad: ${transfer.destination_city || 'N/A'}\nCódigo de retiro: ${transfer.transfer_code}\n\nAcuda a cualquier agente SendDirect para retirar su dinero.`;

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      await Promise.all([
        saveNotification(adminClient, transfer.id, transfer.sender_phone, 'SMS no enviado - Twilio no configurado', 'failed'),
        saveNotification(adminClient, transfer.id, transfer.receiver_phone, 'SMS no enviado - Twilio no configurado', 'failed'),
      ]);
    } else {
      const twilio = await import('twilio');
      const client = twilio.default(accountSid, authToken);

      const formattedSenderPhone = formatPhoneNumber(transfer.sender_phone);
      const formattedReceiverPhone = formatPhoneNumber(transfer.receiver_phone);

      let senderSid: string | null = null;
      let receiverSid: string | null = null;
      let senderError: string | null = null;
      let receiverError: string | null = null;

      try {
        const senderResult = await client.messages.create({
          body: senderMessage,
          from: twilioPhoneNumber,
          to: formattedSenderPhone,
        });
        senderSid = senderResult.sid;
      } catch (error: any) {
        senderError = error?.message || 'Error sending to sender';
        console.error('Error sending SMS to sender:', senderError);
      }

      try {
        const receiverResult = await client.messages.create({
          body: receiverMessage,
          from: twilioPhoneNumber,
          to: formattedReceiverPhone,
        });
        receiverSid = receiverResult.sid;
      } catch (error: any) {
        receiverError = error?.message || 'Error sending to receiver';
        console.error('Error sending SMS to receiver:', receiverError);
      }

      await Promise.all([
        saveNotification(adminClient, transfer.id, transfer.sender_phone, senderMessage, senderSid ? 'sent' : 'failed', senderSid || undefined, senderError || undefined),
        saveNotification(adminClient, transfer.id, transfer.receiver_phone, receiverMessage, receiverSid ? 'sent' : 'failed', receiverSid || undefined, receiverError || undefined),
      ]);
    }

    return NextResponse.json({ success: true, transfer });
  } catch (err) {
    console.error('[POST /api/transfers]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
