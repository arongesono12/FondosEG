import { redirect } from 'next/navigation';
import { ErrorScreen } from '@/components/layout/error-screen';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { WalletLinkConsent } from '@/components/payments/wallet-link-consent';
import { getOptionalAuthState, requireProfile } from '@/lib/server/authz';
import { canDecideLinkRequest } from '@/lib/server/wallet-link-rules';
import { findWalletLinkRequestById } from '@/lib/server/wallet-links';

// Depende de la sesión de Clerk: no se puede prerenderizar.
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WalletLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const linkPath = `/link/${encodeURIComponent(id)}`;
  const { user, serviceUnavailable, needsOnboarding } = await getOptionalAuthState();

  if (serviceUnavailable) return <ServiceUnavailableScreen retryHref={linkPath} />;
  if (needsOnboarding) redirect('/onboarding');
  if (!user) redirect(`/login?redirect_url=${encodeURIComponent(linkPath)}`);

  const linkRequest = UUID_PATTERN.test(id) ? await findWalletLinkRequestById(id) : null;
  if (!linkRequest || !canDecideLinkRequest(linkRequest)) {
    return (
      <ErrorScreen
        badge="404"
        title="Enlace no disponible"
        description="Este enlace para vincular tu billetera no existe, ya se usó o ha caducado. Vuelve a la aplicación e inténtalo otra vez."
        actions={[{ href: '/dashboard', label: 'Ir a mi billetera' }]}
      />
    );
  }

  // El rol vive en el perfil, no en la identidad de la sesión.
  const profile = await requireProfile();

  return (
    <WalletLinkConsent
      requestId={linkRequest.id}
      merchantName={linkRequest.merchant_name}
      destinationHost={new URL(linkRequest.return_url).host}
      expiresAt={linkRequest.expires_at}
      isOwnRequest={linkRequest.merchant_user_id === user.id}
      isClient={profile.role === 'cliente'}
    />
  );
}
