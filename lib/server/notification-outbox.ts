import { createAdminClient } from '@/lib/supabase/admin';
import { buildTransferNotificationMessages } from '@/lib/transfer-notification-messages';

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
  settledToWallet?: boolean;
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
  const { senderMessage, receiverMessage } = buildTransferNotificationMessages({
    transferCode: input.transferCode,
    senderName: input.senderName,
    receiverName: input.receiverName,
    amount: input.amount,
    currency: input.currency,
    destinationCity: input.destinationCity,
    settledToWallet: input.settledToWallet,
  });

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

/**
 * Avisa al beneficiario de que tiene una orden pendiente de cobro.
 *
 * IMPORTANTE: este aviso NO puede contener el código de confirmación. El código
 * es un vale al portador que custodia el emisor y entrega en mano (por QR o de
 * viva voz) cuando decide liquidar la orden. Si el beneficiario lo recibiera por
 * este canal podría cobrar sin que el emisor se lo hubiera entregado, y el paso
 * de entrega dejaría de controlar nada.
 *
 * Por eso `code` no forma parte de la entrada: no se puede filtrar lo que no se
 * recibe.
 */
export async function queueWalletPendingNotice(input: {
  transferId: string;
  phone: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const message = `FondosEG: ${input.senderName} le ha enviado ${input.amount} ${input.currency} a su billetera digital.\n\nPara recibirlo, pida el código de confirmación a ${input.senderName} e introdúzcalo en la aplicación. La orden caduca en 24 horas.`;

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

/** Plazo máximo de una llamada a Twilio: un proveedor lento no debe bloquear el lote. */
const TWILIO_TIMEOUT_MS = 10_000;
/** Espera antes de cada reintento de SMS, por número de intento. */
const SMS_RETRY_DELAYS_SECONDS = [30, 120, 600, 1800];

type ClaimedSmsJob = {
  id: string;
  notification_id: string;
  to_phone: string;
  message: string;
  attempts: number;
  max_attempts: number;
};

/**
 * Twilio responde 4xx a errores que no se arreglan reintentando (número
 * inválido, destino bloqueado…). Sólo se reintentan los fallos de red, los
 * 5xx y el límite de peticiones (429).
 */
function isRetryableSmsError(error: unknown): boolean {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : NaN;
  if (!Number.isFinite(status)) return true;
  return status === 429 || status >= 500;
}

/**
 * Envía los SMS pendientes. Los trabajos se reclaman de forma atómica
 * (`claim_notification_outbox`, FOR UPDATE SKIP LOCKED), así que varios
 * workers pueden ejecutarse a la vez sin enviar dos veces el mismo mensaje.
 *
 * No se llama desde el camino de respuesta de una operación: lo ejecutan
 * `scheduleOutboxProcessing` (tras responder) y el worker `/api/outbox/process`.
 */
export async function processNotificationOutbox(limit: number = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
  retried: number;
}> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc('claim_notification_outbox', { p_limit: limit });

  if (error) {
    throw new Error(error.message);
  }

  const jobs = (data ?? []) as ClaimedSmsJob[];
  if (!jobs.length) {
    return { processed: 0, sent: 0, failed: 0, retried: 0 };
  }

  const finish = async (job: ClaimedSmsJob, outcome: 'sent' | 'failed' | 'retry', details: { sid?: string; error?: string } = {}) => {
    const nowIso = new Date().toISOString();

    if (outcome === 'retry') {
      const delaySeconds = SMS_RETRY_DELAYS_SECONDS[Math.min(job.attempts - 1, SMS_RETRY_DELAYS_SECONDS.length - 1)];
      await adminClient
        .from('notification_outbox')
        .update({
          status: 'pending',
          locked_until: null,
          error_message: details.error ?? null,
          next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        })
        .eq('id', job.id);
      return;
    }

    await adminClient
      .from('notification_outbox')
      .update({
        status: outcome,
        locked_until: null,
        error_message: outcome === 'failed' ? details.error ?? null : null,
        processed_at: nowIso,
      })
      .eq('id', job.id);

    await adminClient
      .from('notifications')
      .update(
        outcome === 'sent'
          ? { status: 'sent', twilio_sid: details.sid, sent_at: nowIso, error_message: null }
          : { status: 'failed', error_message: details.error ?? null }
      )
      .eq('id', job.notification_id);
  };

  if (!accountSid || !authToken || (!twilioPhoneNumber && !twilioMessagingServiceSid && !twilioAlphanumericSenderId)) {
    for (const job of jobs) {
      await finish(job, 'failed', { error: 'Twilio no configurado' });
    }
    return { processed: jobs.length, sent: 0, failed: jobs.length, retried: 0 };
  }

  const twilio = await import('twilio');
  const client = twilio.default(accountSid, authToken, { timeout: TWILIO_TIMEOUT_MS });

  let sent = 0;
  let failed = 0;
  let retried = 0;

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
      await finish(job, 'sent', { sid: result.sid });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Twilio send failed';
      if (isRetryableSmsError(error) && job.attempts < job.max_attempts) {
        await finish(job, 'retry', { error: message });
        retried += 1;
      } else {
        await finish(job, 'failed', { error: message });
        failed += 1;
      }
    }
  }

  return {
    processed: jobs.length,
    sent,
    failed,
    retried,
  };
}
