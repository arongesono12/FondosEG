import twilio from 'twilio';
import { createAdminClient } from '@/lib/supabase/admin';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

interface SMSData {
  transferCode: string;
  senderPhone: string;
  receiverPhone: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
}

export async function sendSMS(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!client || !twilioPhoneNumber) {
    console.log('Twilio not configured, skipping SMS');
    await logNotification(to, message, 'failed', 'Twilio not configured');
    return { success: false, error: 'Twilio no configurado' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to,
    });

    await logNotification(to, message, 'sent', result.sid);
    return { success: true, sid: result.sid };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logNotification(to, message, 'failed', errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function logNotification(phone: string, message: string, status: string, twilioSid?: string) {
  try {
    const adminClient = createAdminClient();
    await adminClient.from('notifications').insert({
      phone,
      message,
      status,
      twilio_sid: twilioSid,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

export async function sendTransferSMS(data: SMSData): Promise<void> {
  const senderMessage = `FondosEG: Su transferencia de ${data.amount}${data.currency} ha sido registrada correctamente. Código: ${data.transferCode}`;
  
  const receiverMessage = `FondosEG: Tiene una transferencia disponible de ${data.amount}${data.currency} de ${data.senderName}. Código de retiro: ${data.transferCode}`;

  await sendSMS(data.senderPhone, senderMessage);
  await sendSMS(data.receiverPhone, receiverMessage);
}

export async function sendBalanceAlert(phone: string, agentName: string, balance: number): Promise<void> {
  const message = `FondosEG: Alerta - El saldo de ${agentName} es bajo: ${balance} EUR. Considere recargar.`;
  await sendSMS(phone, message);
}

export async function sendWelcomeSMS(phone: string, name: string, role: string): Promise<void> {
  const message = `FondosEG: Bienvenido ${name}. Su cuenta de ${role} ha sido creada exitosamente.`;
  await sendSMS(phone, message);
}
