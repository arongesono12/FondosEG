import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAllowedSameOriginMutation } from '@/lib/security/request-policy';
import { AuthzError, requireDashboardAccess, requireProfile } from '@/lib/server/authz';
import { buildWalletLinkReturnUrl } from '@/lib/server/wallet-link-rules';
import {
  decideWalletLinkRequest,
  findWalletLinkRequestById,
  WalletLinkRejectedError,
} from '@/lib/server/wallet-links';

/**
 * Decisión del cliente sobre una solicitud de vínculo desde `/link/[id]`:
 * autorizar (se genera el código de un solo uso) o rechazar. Requiere sesión;
 * la API key del comercio nunca puede autorizarse a sí misma.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const actionSchema = z.object({ action: z.enum(['approve', 'deny']) });

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const sameOrigin = isAllowedSameOriginMutation({
    requestHost: request.headers.get('host') ?? '',
    origin: request.headers.get('origin'),
    fetchSite: request.headers.get('sec-fetch-site'),
  });
  if (!sameOrigin) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
  }

  try {
    const user = await requireProfile();
    await requireDashboardAccess();
    const { id } = await routeContext.params;

    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!UUID_PATTERN.test(id) || !parsed.success) {
      return NextResponse.json({ error: 'Solicitud no válida' }, { status: 400 });
    }

    // Solo una billetera de cliente tiene saldo que compartir.
    if (user.role !== 'cliente') {
      return NextResponse.json({ error: 'Solo los clientes pueden vincular su billetera' }, { status: 403 });
    }

    const linkRequest = await findWalletLinkRequestById(id);
    if (!linkRequest) {
      return NextResponse.json({ error: 'La solicitud de vínculo no existe' }, { status: 404 });
    }

    const approve = parsed.data.action === 'approve';
    const { code } = await decideWalletLinkRequest({ request: linkRequest, payerUserId: user.id, approve });
    const redirectUrl = buildWalletLinkReturnUrl(
      linkRequest.return_url,
      code ? { code } : { error: 'denied' },
      linkRequest.state
    );

    return NextResponse.json({ success: true, status: approve ? 'approved' : 'denied', redirect_url: redirectUrl });
  } catch (error) {
    if (error instanceof WalletLinkRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Wallet link decision error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
