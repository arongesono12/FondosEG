import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { reconcileProfileFromClerkWebhook } from '@/lib/server/clerk-identity';

/**
 * Webhook de Clerk: user.created / user.updated.
 *
 * Recibe el evento firmado por Svix, lo verifica con la firma de
 * `CLERK_WEBHOOK_SIGNING_SECRET` y reconcilia nombre, correo, avatar y rol
 * del perfil en `public.users` cuando el usuario o el admin los cambian en el
 * dashboard de Clerk (o cuando un usuario existente entra por primera vez con
 * Google).
 *
 * Ruta pública: no pasa por `auth.protect()` (proxy.ts no protege rutas).
 * Posteriormente, el layout del dashboard refuerza la reconciliación con una
 * llamada throttled a `syncProfileFromClerkIfNeeded`.
 */

const SUPPORTED_EVENTS = new Set(['user.created', 'user.updated']);

function primaryEmail(
  addresses: { id?: string | null; email_address?: string | null }[],
  primaryId?: string | null,
): string | null {
  const chosen = addresses.find((a) => a.id === primaryId) ?? addresses[0];
  const raw = chosen?.email_address;
  return raw?.toLowerCase().trim() ?? null;
}

function fullName(
  firstName?: string | null,
  lastName?: string | null,
  username?: string | null,
): string | null {
  const joined = [firstName ?? '', lastName ?? '']
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  if (joined) return joined;
  return username?.trim() || null;
}

export async function POST(req: NextRequest) {
  let evt;

  try {
    evt = await verifyWebhook(req);
  } catch (error) {
    console.error('Verificación de webhook de Clerk fallida:', error);
    return new NextResponse('Verificación fallida', { status: 400 });
  }

  if (!SUPPORTED_EVENTS.has(evt.type)) {
    return new NextResponse('OK', { status: 200 });
  }

  // narrow: Sólo user.created / user.updated llegan aquí; data es UserJSON.
  const { data } = evt as Extract<typeof evt, { type: 'user.created' | 'user.updated' }>;
  const email = primaryEmail(
    data.email_addresses,
    data.primary_email_address_id,
  );
  const name = fullName(data.first_name, data.last_name, data.username);
  const imageUrl = typeof data.image_url === 'string' ? data.image_url : null;
  const declaredRole =
    typeof data.public_metadata?.role === 'string'
      ? data.public_metadata.role
      : null;

  try {
    await reconcileProfileFromClerkWebhook({
      clerkUserId: data.id,
      email,
      name,
      imageUrl,
      declaredRole,
    });
  } catch (error) {
    console.error('Error procesando el webhook de Clerk:', error);
    // Devolvemos 500 para que Svix reintente y no perdamos el evento.
    return new NextResponse('Error procesando el evento', { status: 500 });
  }

  return new NextResponse('OK', { status: 200 });
}
