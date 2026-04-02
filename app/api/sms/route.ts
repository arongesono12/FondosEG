import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

interface SMSBody {
  transferId: string;
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
    // Avoid failing the whole request due to notification logging.
    console.error('Error saving notification:', err);
  }
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = createAdminClient();

  try {
    const profile = await requireProfile();
    requireRole(profile, ['admin', 'gestor']);

    const body: SMSBody = await request.json();
    if (!body.transferId) {
      return NextResponse.json({ error: 'transferId is required' }, { status: 400 });
    }

    const { data: transfer, error: transferError } = await supabaseAdmin
      .from('transfers')
      .select('id, transfer_code, agent_id, sender_name, sender_phone, receiver_name, receiver_phone, destination_city, amount, currency')
      .eq('id', body.transferId)
      .single();

    if (transferError || !transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    if (profile.role === 'gestor' && transfer.agent_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const senderMessage = `FondosEG: Su transferencia de ${transfer.amount} ${transfer.currency} ha sido registrada correctamente.\n\nRemitente: ${transfer.sender_name}\nDestinatario: ${transfer.receiver_name}\nMonto: ${transfer.amount} ${transfer.currency}\nCódigo: ${transfer.transfer_code}\n\nGracias por confiar en FondosEG.`;

    const receiverMessage = `FondosEG: Tiene una transferencia disponible de ${transfer.amount} ${transfer.currency} de ${transfer.sender_name}.\n\nCiudad: ${transfer.destination_city || 'N/A'}\nCódigo de retiro: ${transfer.transfer_code}\n\nAcuda a cualquier agente FondosEG para retirar su dinero.`;

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      await Promise.all([
        saveNotification(supabaseAdmin, transfer.id, transfer.sender_phone, 'SMS no enviado - Twilio no configurado', 'failed'),
        saveNotification(supabaseAdmin, transfer.id, transfer.receiver_phone, 'SMS no enviado - Twilio no configurado', 'failed'),
      ]);
      return NextResponse.json({ success: true, message: 'Twilio no configurado, SMS omitido' });
    }

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
      saveNotification(
        supabaseAdmin,
        transfer.id,
        transfer.sender_phone,
        senderMessage,
        senderSid ? 'sent' : 'failed',
        senderSid || undefined,
        senderError || undefined
      ),
      saveNotification(
        supabaseAdmin,
        transfer.id,
        transfer.receiver_phone,
        receiverMessage,
        receiverSid ? 'sent' : 'failed',
        receiverSid || undefined,
        receiverError || undefined
      ),
    ]);

    return NextResponse.json({
      success: true,
      senderSid,
      receiverSid,
      senderStatus: senderSid ? 'sent' : 'failed',
      receiverStatus: receiverSid ? 'sent' : 'failed',
      senderError,
      receiverError,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('SMS Error:', errorMessage);
    if (error instanceof AuthzError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

