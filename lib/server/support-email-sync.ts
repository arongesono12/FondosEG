import 'server-only';

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

import { createAdminClient } from '@/lib/supabase/admin';

type SupportEmailSyncStats = {
  fetched: number;
  inserted: number;
  skipped: number;
  failed: number;
};

type SupportProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
};

const DEFAULT_IMAP_HOST = 'my.space.email';
const DEFAULT_IMAP_PORT = 993;
const SUPPORT_EMAIL_ADDRESS = (process.env.SUPPORT_EMAIL || 'support@fondoseg.com').trim().toLowerCase();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to sync support emails`);
  }
  return value;
}

function normalizeEmail(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function getMailboxAddress(addresses?: { address?: string | false }[] | null): string | null {
  const address = addresses?.find((item) => typeof item.address === 'string')?.address;
  return normalizeEmail(address || null);
}

function getParsedAddressList(value: unknown): { address?: string | false }[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.flatMap((item) => getParsedAddressList(item) ?? []);
  }
  if (typeof value === 'object' && 'value' in value) {
    return (value as { value?: { address?: string | false }[] }).value ?? null;
  }
  return null;
}

function buildInboundMessageText(input: {
  fromEmail: string | null;
  toEmail: string | null;
  subject: string;
  text: string;
}): string {
  return [
    `Email recibido en ${SUPPORT_EMAIL_ADDRESS}`,
    `De: ${input.fromEmail || 'No disponible'}`,
    `Para: ${input.toEmail || SUPPORT_EMAIL_ADDRESS}`,
    `Asunto: ${input.subject || 'Sin asunto'}`,
    '',
    input.text || '(Sin contenido de texto)',
  ].join('\n');
}

async function findProfileByEmail(email: string | null): Promise<SupportProfile | null> {
  if (!email) return null;

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('users')
    .select('id, name, email, phone, role')
    .ilike('email', email)
    .maybeSingle();

  return (data as SupportProfile | null) ?? null;
}

async function notifyAdmins(message: string, userId: string | null): Promise<void> {
  try {
    const adminClient = createAdminClient();
    await adminClient.from('notifications').insert({
      message,
      status: 'pending',
      is_admin_notification: true,
      priority: 'normal',
      user_id: userId,
    });
  } catch (error) {
    console.error('[support-email-sync] Failed to create admin notification:', error);
  }
}

export async function syncSupportInbox(limit = 20): Promise<SupportEmailSyncStats> {
  const user = getRequiredEnv('SUPPORT_EMAIL_IMAP_USER');
  const pass = getRequiredEnv('SUPPORT_EMAIL_IMAP_PASSWORD');
  const host = process.env.SUPPORT_EMAIL_IMAP_HOST?.trim() || DEFAULT_IMAP_HOST;
  const port = Number(process.env.SUPPORT_EMAIL_IMAP_PORT || DEFAULT_IMAP_PORT);
  const mailbox = process.env.SUPPORT_EMAIL_IMAP_MAILBOX?.trim() || 'INBOX';
  const markSeen = process.env.SUPPORT_EMAIL_MARK_SEEN !== 'false';
  const maxMessages = Math.min(Math.max(limit, 1), 100);

  const stats: SupportEmailSyncStats = { fetched: 0, inserted: 0, skipped: 0, failed: 0 };
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock(mailbox);

  try {
    const unseenUids = await client.search({ seen: false }, { uid: true });
    if (!unseenUids) return stats;

    const uids = unseenUids.slice(0, maxMessages);
    if (uids.length === 0) return stats;

    const adminClient = createAdminClient();

    for await (const message of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
      stats.fetched += 1;

      try {
        if (!message.source) {
          stats.skipped += 1;
          continue;
        }

        const parsed = await simpleParser(message.source);
        const messageId = parsed.messageId?.trim() || `imap:${SUPPORT_EMAIL_ADDRESS}:${message.uid}`;
        const fromEmail = getMailboxAddress(getParsedAddressList(parsed.from));
        const replyToEmail = getMailboxAddress(getParsedAddressList(parsed.replyTo));
        const toEmail = getMailboxAddress(getParsedAddressList(parsed.to));
        const subject = parsed.subject?.trim() || 'Sin asunto';
        const text = (parsed.text || parsed.textAsHtml || '').trim();
        const profile = await findProfileByEmail(replyToEmail || fromEmail);

        const inboundMessage = buildInboundMessageText({
          fromEmail: replyToEmail || fromEmail,
          toEmail,
          subject,
          text,
        });

        const { error } = await adminClient.from('support_messages').insert({
          user_id: profile?.id ?? null,
          target_user_id: null,
          user_name: profile?.name || parsed.from?.text || fromEmail || 'Remitente externo',
          user_email: replyToEmail || fromEmail,
          message: inboundMessage,
          status: 'pending',
          request_type: 'email_reply',
          email_message_id: messageId,
          email_subject: subject,
          email_from: replyToEmail || fromEmail,
          email_to: toEmail || SUPPORT_EMAIL_ADDRESS,
          email_received_at: parsed.date?.toISOString() || new Date().toISOString(),
          email_direction: 'inbound',
        });

        if (error) {
          if (error.code === '23505') {
            stats.skipped += 1;
          } else {
            console.error('[support-email-sync] Failed to save inbound email:', error);
            stats.failed += 1;
          }
          continue;
        }

        stats.inserted += 1;
        await notifyAdmins(
          `Nuevo email recibido en soporte.\n\nDe: ${replyToEmail || fromEmail || 'No disponible'}\nAsunto: ${subject}`,
          profile?.id ?? null
        );

        if (markSeen) {
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
        }
      } catch (error) {
        console.error('[support-email-sync] Failed to process inbound email:', error);
        stats.failed += 1;
      }
    }

    return stats;
  } finally {
    lock.release();
    await client.logout();
  }
}
