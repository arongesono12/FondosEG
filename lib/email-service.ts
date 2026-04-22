import { Resend } from 'resend';

// ---------------------------------------------------------------------------
// Startup validation — fail loudly so misconfiguration is obvious in logs.
// ---------------------------------------------------------------------------
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const FROM_EMAIL           = process.env.RESEND_FROM_EMAIL;
const PRIMARY_EMAIL_DOMAIN = 'fondoseg.com';
const DEFAULT_FROM_EMAIL   = `FondosEG <no-reply@${PRIMARY_EMAIL_DOMAIN}>`;
const APP_BASE_URL         = process.env.NEXT_PUBLIC_APP_URL || 'https://fondoseg.com';

if (!RESEND_API_KEY) {
  console.error(
    '[email-service] RESEND_API_KEY is not set. ' +
    'Emails will NOT be sent. Set it in .env.local'
  );
}

if (!FROM_EMAIL) {
  console.error(
    '[email-service] RESEND_FROM_EMAIL is not set. ' +
    'Emails will NOT be sent. ' +
    `Set it to e.g. "${DEFAULT_FROM_EMAIL}" after verifying the domain in resend.com`
  );
}

const resend        = new Resend(RESEND_API_KEY);
const SENDER_EMAIL  = FROM_EMAIL ?? 'onboarding@resend.dev';

function extractSenderAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function getSenderDomain(value: string): string {
  return extractSenderAddress(value).split('@')[1] ?? '';
}

function isFondosEGDomain(domain: string): boolean {
  return domain === PRIMARY_EMAIL_DOMAIN || domain.endsWith(`.${PRIMARY_EMAIL_DOMAIN}`);
}

function humanizeResendError(message?: string): string {
  const normalized = (message || '').toLowerCase();

  if (
    normalized.includes('you can only send testing emails to your own email address') ||
    normalized.includes('verify a domain at resend.com/domains')
  ) {
    return `El servicio de correo esta en modo de pruebas. Verifica el dominio en Resend y usa RESEND_FROM_EMAIL con una direccion del dominio verificado, por ejemplo: ${DEFAULT_FROM_EMAIL}.`;
  }

  if (
    normalized.includes('from address') &&
    (normalized.includes('verified domain') || normalized.includes('domain'))
  ) {
    return 'La direccion remitente no pertenece a un dominio verificado en Resend. Actualiza RESEND_FROM_EMAIL para usar un correo del dominio verificado.';
  }

  if (normalized.includes('api key')) {
    return 'La configuracion de Resend no es valida. Revisa RESEND_API_KEY en el servidor.';
  }

  return message || 'No se pudo enviar el correo de verificacion.';
}

function getEmailConfigurationError(): string | null {
  if (!RESEND_API_KEY) {
    return 'El servicio de correo no esta configurado. Falta RESEND_API_KEY en el servidor.';
  }

  if (!FROM_EMAIL) {
    return 'El servicio de correo no esta configurado. Falta RESEND_FROM_EMAIL en el servidor.';
  }

  const senderDomain = getSenderDomain(SENDER_EMAIL);
  if (senderDomain === 'resend.dev') {
    return `El remitente de correo sigue usando onboarding@resend.dev. Configura RESEND_FROM_EMAIL con un correo de tu dominio verificado en Resend, por ejemplo: ${DEFAULT_FROM_EMAIL}.`;
  }

  if (!isFondosEGDomain(senderDomain)) {
    return `RESEND_FROM_EMAIL debe usar ${PRIMARY_EMAIL_DOMAIN} o un subdominio suyo. Valor esperado, por ejemplo: ${DEFAULT_FROM_EMAIL}.`;
  }

  return null;
}

export interface SendOTPEmailParams {
  to: string;
  name: string;
  code: string;
}

export async function sendOTPEmail({ to, name, code }: SendOTPEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const configError = getEmailConfigurationError();
    if (configError) {
      return { success: false, error: configError };
    }

    const { data, error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: [to],
      subject: 'Código de verificación - FondosEG',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 480px; margin: 40px auto; padding: 20px;">
            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%); padding: 40px 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800;">FondosEG</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">Verificación de correo electrónico</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px; text-align: center;">
                <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">Hola <strong>${name}</strong>,</p>
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 30px; line-height: 1.6;">
                  Has solicitado verificar tu dirección de correo electrónico. Utiliza el siguiente código para completar la verificación:
                </p>
                
                <!-- OTP Code -->
                <div style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border: 2px dashed #ec4899; border-radius: 12px; padding: 24px; margin: 0 auto 30px; max-width: 240px;">
                  <p style="color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px;">Tu código es</p>
                  <p style="color: #ec4899; font-size: 36px; font-weight: 800; margin: 0; letter-spacing: 8px;">${code}</p>
                </div>
                
                <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6;">
                  Este código expira en <strong>15 minutos</strong>. Si no solicitaste esta verificación, puedes ignorar este correo de forma segura.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                  © ${new Date().getFullYear()} FondosEG. Todos los derechos reservados.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        FondosEG - Verificación de correo electrónico
        
        Hola ${name},
        
        Has solicitado verificar tu dirección de correo electrónico. Utiliza el siguiente código:
        
        Tu código es: ${code}
        
        Este código expira en 15 minutos. Si no solicitaste esta verificación, puedes ignorar este correo.
        
        © ${new Date().getFullYear()} FondosEG
      `,
    });

    if (error) {
      console.error('[email-service] Resend OTP error:', JSON.stringify(error));
      return { success: false, error: humanizeResendError(error.message) };
    }

    console.log('OTP email sent:', data?.id);
    return { success: true };

  } catch (error) {
    console.error('Send OTP email error:', error);
    return {
      success: false,
      error: humanizeResendError(error instanceof Error ? error.message : undefined),
    };
  }
}

export interface SendWelcomeEmailParams {
  to: string;
  name: string;
  role: string;
}

export async function sendWelcomeEmail({ to, name, role }: SendWelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const roleText = role === 'gestor' ? 'Gestor' : 'Cliente';
    
    const configError = getEmailConfigurationError();
    if (configError) {
      return { success: false, error: configError };
    }

    const { error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: [to],
      subject: '¡Bienvenido a FondosEG!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 480px; margin: 40px auto; padding: 20px;">
            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%); padding: 40px 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800;">FondosEG</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">¡Cuenta verificada!</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px; text-align: center;">
                <div style="width: 80px; height: 80px; background: #dcfce7; border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                
                <p style="color: #374151; font-size: 18px; margin: 0 0 16px;">¡Bienvenido, <strong>${name}</strong>!</p>
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
                  Tu correo ha sido verificado exitosamente. Ahora eres parte de FondosEG como <strong>${roleText}</strong>.
                </p>
                
                <a href="${APP_BASE_URL}" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px;">
                  Ir a FondosEG
                </a>
              </div>
              
              <!-- Footer -->
              <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                  © ${new Date().getFullYear()} FondosEG. Todos los derechos reservados.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[email-service] Resend welcome email error:', JSON.stringify(error));
      return { success: false, error: humanizeResendError(error.message) };
    }

    return { success: true };

  } catch (error) {
    console.error('Send welcome email error:', error);
    return {
      success: false,
      error: humanizeResendError(error instanceof Error ? error.message : undefined),
    };
  }
}

const DEFAULT_SUPPORT_EMAIL = 'support@fondoseg.com';
const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim();

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatSupportRequestType(requestType?: string | null): string {
  switch (requestType) {
    case 'balance_topup':
      return 'Solicitud de recarga';
    case 'report_error':
      return 'Reporte de error';
    case 'general':
    default:
      return 'Contacto al equipo';
  }
}

export interface SendSupportRequestEmailParams {
  fromName: string;
  fromEmail?: string | null;
  fromPhone?: string | null;
  fromRole?: string | null;
  message: string;
  requestType?: string | null;
  targetName?: string | null;
  targetRole?: string | null;
}

export async function sendSupportRequestEmail({
  fromName,
  fromEmail,
  fromPhone,
  fromRole,
  message,
  requestType,
  targetName,
  targetRole,
}: SendSupportRequestEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const configError = getEmailConfigurationError();
    if (configError) {
      return { success: false, error: configError };
    }

    const requestTypeLabel = formatSupportRequestType(requestType);
    const resolvedTarget = targetName
      ? `${targetName}${targetRole ? ` (${targetRole})` : ''}`
      : 'Equipo de soporte';
    const replyTo = fromEmail?.trim() ? fromEmail.trim() : undefined;
    const safeMessage = escapeHtml(message.trim());

    const { error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: [SUPPORT_EMAIL],
      replyTo: replyTo ? [replyTo] : undefined,
      subject: `[FondosEG] ${requestTypeLabel} - ${fromName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; color: #111827;">
          <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%); padding: 28px 32px; color: #ffffff;">
              <p style="margin: 0 0 6px; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; opacity: 0.9;">FondosEG Support</p>
              <h1 style="margin: 0; font-size: 24px; line-height: 1.2;">${escapeHtml(requestTypeLabel)}</h1>
            </div>
            <div style="padding: 32px;">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; width: 180px; font-weight: 600;">Nombre</td>
                  <td style="padding: 10px 0;">${escapeHtml(fromName)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Correo</td>
                  <td style="padding: 10px 0;">${escapeHtml(fromEmail?.trim() || 'No disponible')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Telefono</td>
                  <td style="padding: 10px 0;">${escapeHtml(fromPhone?.trim() || 'No disponible')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Rol</td>
                  <td style="padding: 10px 0;">${escapeHtml(fromRole?.trim() || 'No disponible')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 600;">Destino interno</td>
                  <td style="padding: 10px 0;">${escapeHtml(resolvedTarget)}</td>
                </tr>
              </table>

              <div style="border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; background: #f9fafb;">
                <p style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700;">Mensaje</p>
                <div style="white-space: pre-wrap; line-height: 1.7;">${safeMessage}</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: [
        'FondosEG - Nuevo mensaje de soporte',
        '',
        `Tipo: ${requestTypeLabel}`,
        `Nombre: ${fromName}`,
        `Correo: ${fromEmail?.trim() || 'No disponible'}`,
        `Telefono: ${fromPhone?.trim() || 'No disponible'}`,
        `Rol: ${fromRole?.trim() || 'No disponible'}`,
        `Destino interno: ${resolvedTarget}`,
        '',
        'Mensaje:',
        message.trim(),
      ].join('\n'),
    });

    if (error) {
      console.error('[email-service] Resend support email error:', JSON.stringify(error));
      return { success: false, error: humanizeResendError(error.message) };
    }

    return { success: true };
  } catch (error) {
    console.error('Send support email error:', error);
    return {
      success: false,
      error: humanizeResendError(error instanceof Error ? error.message : undefined),
    };
  }
}
