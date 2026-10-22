import { NextResponse } from 'next/server';
import { AuthzError, requireProfile } from '@/lib/server/authz';
import { listActiveWalletLinksForPayer } from '@/lib/server/wallet-links';

/** Apps a las que el cliente dio acceso de solo lectura a su saldo. */
export async function GET() {
  try {
    const user = await requireProfile();
    const links = await listActiveWalletLinksForPayer(user.id);
    return NextResponse.json({
      success: true,
      links: links.map((link) => ({
        id: link.id,
        merchant_name: link.merchant_name,
        scopes: link.scopes,
        created_at: link.created_at,
        last_used_at: link.last_used_at,
      })),
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Wallet links list error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
