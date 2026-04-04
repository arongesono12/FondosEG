import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { createAgentTransferOperation } from '@/lib/server/financial-operations';
import type { Transfer, TransferFormData } from '@/types';
import { generateTransferCode } from '@/lib/utils';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

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
        .or(`agent_id.eq.${profile.id},paid_out_by.eq.${profile.id}`)
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

    const transferCode = generateTransferCode();
    const { transfer } = await createAgentTransferOperation({
      agentId: profile.id,
      actorUserId: profile.id,
      transferCode,
      senderName: body.sender_name,
      senderPhone: body.sender_phone,
      senderDocumentType: body.sender_document_type,
      senderDocumentNumber: body.sender_document_number,
      receiverName: body.receiver_name,
      receiverPhone: body.receiver_phone,
      receiverDocumentType: body.receiver_document_type,
      receiverDocumentNumber: body.receiver_document_number,
      destinationCity: body.destination_city,
      destinationCountry: body.destination_country,
      amount: Number(body.amount),
      currency: body.currency,
      notes: body.notes,
    });

    const typedTransfer = transfer as Transfer;

    // Send SMS from the server (never from the browser).
    const senderMessage = `FondosEG: Su transferencia de ${typedTransfer.amount} ${typedTransfer.currency} ha sido registrada correctamente.\n\nRemitente: ${typedTransfer.sender_name}\nDestinatario: ${typedTransfer.receiver_name}\nMonto: ${typedTransfer.amount} ${typedTransfer.currency}\nCódigo: ${typedTransfer.transfer_code}\n\nGracias por confiar en FondosEG.`;
    const receiverMessage = `FondosEG: Tiene una transferencia disponible de ${typedTransfer.amount} ${typedTransfer.currency} de ${typedTransfer.sender_name}.\n\nCiudad: ${typedTransfer.destination_city || 'N/A'}\nCódigo de retiro: ${typedTransfer.transfer_code}\n\nAcuda a cualquier agente FondosEG para retirar su dinero.`;

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      await Promise.all([
        saveNotification(adminClient, typedTransfer.id, typedTransfer.sender_phone, 'SMS no enviado - Twilio no configurado', 'failed'),
        saveNotification(adminClient, typedTransfer.id, typedTransfer.receiver_phone, 'SMS no enviado - Twilio no configurado', 'failed'),
      ]);
    } else {
      const twilio = await import('twilio');
      const client = twilio.default(accountSid, authToken);

      const formattedSenderPhone = formatPhoneNumber(typedTransfer.sender_phone);
      const formattedReceiverPhone = formatPhoneNumber(typedTransfer.receiver_phone);

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
        saveNotification(adminClient, typedTransfer.id, typedTransfer.sender_phone, senderMessage, senderSid ? 'sent' : 'failed', senderSid || undefined, senderError || undefined),
        saveNotification(adminClient, typedTransfer.id, typedTransfer.receiver_phone, receiverMessage, receiverSid ? 'sent' : 'failed', receiverSid || undefined, receiverError || undefined),
      ]);
    }

    return NextResponse.json({ success: true, transfer: typedTransfer });
  } catch (err) {
    console.error('[POST /api/transfers]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    if (err instanceof Error && err.message) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
