import { createAdminClient } from '@/lib/supabase/admin';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const twilioAlphanumericSenderId = process.env.TWILIO_ALPHANUMERIC_SENDER_ID;

type NotificationPriority = 'low' | 'normal' | 'high';

interface QueueNotificationInput {
  transferId?: string | null;
  userId?: string | null;
  phone: string;
  message: string;
  status?: 'pending' | 'sent' | 'failed';
  priority?: NotificationPriority;
  kind?: 'sms';
}

interface QueueTransferNotificationsInput {
  transferId: string;
  transferCode: string;
  senderPhone: string;
  receiverPhone: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
  destinationCity?: string | null;
  receiverUserId?: string | null;
  creditedToWallet?: boolean;
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  // Special handling for Cameroon (+237)
  if (cleaned.startsWith('237')) return `+${cleaned}`;
  if (cleaned.startsWith('6') && cleaned.length === 9) return `+237${cleaned}`;
  if (cleaned.startsWith('00237')) return `+${cleaned.substring(2)}`;
  
  // For other numbers, ensure it has a +
  if (phone.trim().startsWith('+')) return phone.trim();
  return `+${cleaned}`;
}

export async function saveInternalNotification(input: QueueNotificationInput): Promise<string> {
  const adminClient = createAdminClient();

  const { data: notification, error: notificationError } = await adminClient
    .from('notifications')
    .insert({
      transfer_id: input.transferId ?? null,
      user_id: input.userId ?? null,
      phone: input.phone,
      message: input.message,
      status: input.status ?? 'sent', // Internal notifications default to 'sent'
      priority: input.priority ?? 'normal',
      is_admin_notification: false,
    })
    .select('id')
    .single();

  if (notificationError || !notification) {
    throw new Error(notificationError?.message || 'No se pudo crear la notificación interna');
  }

  return notification.id;
}

export async function queueNotification(input: QueueNotificationInput): Promise<void> {
  const adminClient = createAdminClient();
  const notificationId = await saveInternalNotification({ ...input, status: 'pending' });

  const { error: outboxError } = await adminClient.from('notification_outbox').insert({
    notification_id: notificationId,
    kind: input.kind ?? 'sms',
    to_phone: input.phone,
    message: input.message,
    status: 'pending',
  });

  if (outboxError) {
    throw new Error(outboxError.message);
  }
}

export async function queueTransferNotifications(input: QueueTransferNotificationsInput): Promise<void> {
  const senderMessage = `FondosEG: Su transferencia de ${input.amount} ${input.currency} ha sido registrada correctamente.\n\nCodigo: ${input.transferCode}\nDestinatario: ${input.receiverName}\nMonto: ${input.amount} ${input.currency}\n\nGracias por confiar en FondosEG.`;
  const receiverMessage = input.creditedToWallet
    ? `FondosEG: Ha recibido ${input.amount} ${input.currency} de ${input.senderName}.\n\nSu saldo ya esta disponible en la billetera del dashboard.\nCodigo de retiro: ${input.transferCode}\n\nPuede usar el saldo desde su cuenta o retirarlo en efectivo con un gestor FondosEG.`
    : `FondosEG: Tiene una transferencia disponible de ${input.amount} ${input.currency} de ${input.senderName}.\n\nCodigo de retiro: ${input.transferCode}\nCiudad: ${input.destinationCity || 'N/A'}\n\nAcuda a un agente FondosEG para retirar su dinero.`;

  await Promise.all([
    queueNotification({
      transferId: input.transferId,
      phone: input.senderPhone,
      message: senderMessage,
      priority: 'normal',
    }),
    queueNotification({
      transferId: input.transferId,
      userId: input.receiverUserId ?? null,
      phone: input.receiverPhone,
      message: receiverMessage,
      priority: 'high',
    }),
  ]);
}

export async function queueWalletVerificationInternal(input: {
  transferId: string;
  phone: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
  code: string;
}): Promise<void> {
  const message = `FondosEG: Su código de verificación para el envío de ${input.amount} ${input.currency} de ${input.senderName} es: ${input.code}.\n\nNo comparta este código con nadie.`;
  
  await saveInternalNotification({
    transferId: input.transferId,
    phone: input.phone,
    message,
    priority: 'high',
  });
}

export async function queueWalletConfirmationInternal(input: {
  transferId: string;
  phone: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const message = `FondosEG: ¡Envío completado! Ha recibido ${input.amount} ${input.currency} de ${input.senderName} en su billetera digital.`;
  
  await saveInternalNotification({
    transferId: input.transferId,
    phone: input.phone,
    message,
    priority: 'high',
  });
}

export async function processNotificationOutbox(limit: number = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const adminClient = createAdminClient();
  const { data: jobs, error } = await adminClient
    .from('notification_outbox')
    .select('id, notification_id, to_phone, message, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  if (!jobs?.length) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  if (!accountSid || !authToken || (!twilioPhoneNumber && !twilioMessagingServiceSid && !twilioAlphanumericSenderId)) {
    const nowIso = new Date().toISOString();
    for (const job of jobs) {
      await adminClient
        .from('notification_outbox')
        .update({
          status: 'failed',
          error_message: 'Twilio no configurado',
          attempts: Number(job.attempts || 0) + 1,
          processed_at: nowIso,
        })
        .eq('id', job.id);

      await adminClient
        .from('notifications')
        .update({
          status: 'failed',
          error_message: 'Twilio no configurado',
        })
        .eq('id', job.notification_id);
    }

    return { processed: jobs.length, sent: 0, failed: jobs.length };
  }

  const twilio = await import('twilio');
  const client = twilio.default(accountSid, authToken);
  const nowIso = new Date().toISOString();

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const messagePayload: {
        body: string;
        to: string;
        from?: string;
        messagingServiceSid?: string;
      } = {
        body: job.message,
        to: formatPhoneNumber(job.to_phone),
      };

      if (twilioMessagingServiceSid) {
        messagePayload.messagingServiceSid = twilioMessagingServiceSid;
      } else if (twilioAlphanumericSenderId) {
        messagePayload.from = twilioAlphanumericSenderId;
      } else if (twilioPhoneNumber) {
        messagePayload.from = twilioPhoneNumber;
      }

      const result = await client.messages.create(messagePayload);

      await adminClient
        .from('notification_outbox')
        .update({
          status: 'sent',
          attempts: Number(job.attempts || 0) + 1,
          processed_at: nowIso,
        })
        .eq('id', job.id);

      await adminClient
        .from('notifications')
        .update({
          status: 'sent',
          twilio_sid: result.sid,
          sent_at: nowIso,
          error_message: null,
        })
        .eq('id', job.notification_id);

      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Twilio send failed';
      await adminClient
        .from('notification_outbox')
        .update({
          status: 'failed',
          error_message: message,
          attempts: Number(job.attempts || 0) + 1,
          processed_at: nowIso,
        })
        .eq('id', job.id);

      await adminClient
        .from('notifications')
        .update({
          status: 'failed',
          error_message: message,
        })
        .eq('id', job.notification_id);

      failed += 1;
    }
  }

  return {
    processed: jobs.length,
    sent,
    failed,
  };
}
