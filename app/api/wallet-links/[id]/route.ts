import { NextRequest, NextResponse } from 'next/server';
import { isAllowedSameOriginMutation } from '@/lib/security/request-policy';
import { AuthzError, requireProfile } from '@/lib/server/authz';
import { revokeWalletLink } from '@/lib/server/wallet-links';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

/** El cliente retira el acceso de una app conectada a su saldo. */
export async function DELETE(request: NextRequest, routeContext: RouteContext) {
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
    const { id } = await routeContext.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Vínculo no válido' }, { status: 400 });
    }

    const revoked = await revokeWalletLink({ linkId: id, by: 'payer', ownerUserId: user.id });
    if (!revoked) {
      return NextResponse.json({ error: 'El vínculo no existe o ya estaba revocado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Wallet link revoke error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
