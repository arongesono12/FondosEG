import { createAdminClient } from '@/lib/supabase/admin';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

type NotificationPriority = 'low' | 'normal' | 'high';

interface QueueNotificationInput {
  transferId?: string | null;
  userId?: string | null;
  phone: string;
  message: string;
  priority?: NotificationPriority;
  kind?: 'sms';
}

interface QueueTransferNotificationsInput {
  transferId: string;
  senderPhone: string;
  receiverPhone: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
  destinationCity?: string | null;
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('237')) return `+${cleaned}`;
  if (cleaned.startsWith('6') && cleaned.length === 9) return `+237${cleaned}`;
  if (phone.trim().startsWith('+')) return phone.trim();
  return `+${cleaned}`;
}

export async function queueNotification(input: QueueNotificationInput): Promise<void> {
  const adminClient = createAdminClient();

  const { data: notification, error: notificationError } = await adminClient
    .from('notifications')
    .insert({
      transfer_id: input.transferId ?? null,
      user_id: input.userId ?? null,
      phone: input.phone,
      message: input.message,
      status: 'pending',
      priority: input.priority ?? 'normal',
      is_admin_notification: false,
    })
    .select('id')
    .single();

  if (notificationError || !notification) {
    throw new Error(notificationError?.message || 'No se pudo crear la notificación');
  }

  const { error: outboxError } = await adminClient.from('notification_outbox').insert({
    notification_id: notification.id,
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
  const senderMessage = `FondosEG: Su transferencia de ${input.amount} ${input.currency} ha sido registrada correctamente.\n\nRemitente: ${input.senderName}\nDestinatario: ${input.receiverName}\nMonto: ${input.amount} ${input.currency}\n\nGracias por confiar en FondosEG.`;
  const receiverMessage = `FondosEG: Tiene una transferencia disponible de ${input.amount} ${input.currency} de ${input.senderName}.\n\nCiudad: ${input.destinationCity || 'N/A'}\nDestinatario: ${input.receiverName}\n\nAcuda a un agente FondosEG para retirar su dinero.`;

  await Promise.all([
    queueNotification({
      transferId: input.transferId,
      phone: input.senderPhone,
      message: senderMessage,
      priority: 'normal',
    }),
    queueNotification({
      transferId: input.transferId,
      phone: input.receiverPhone,
      message: receiverMessage,
      priority: 'high',
    }),
  ]);
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

  if (!accountSid || !authToken || !twilioPhoneNumber) {
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
      const result = await client.messages.create({
        body: job.message,
        from: twilioPhoneNumber,
        to: formatPhoneNumber(job.to_phone),
      });

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

