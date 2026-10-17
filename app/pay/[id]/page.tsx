import { redirect } from 'next/navigation';
import { ErrorScreen } from '@/components/layout/error-screen';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { PaymentRequestCheckout } from '@/components/payments/payment-request-checkout';
import { getOptionalAuthState } from '@/lib/server/authz';
import { resolvePaymentRequestStatus } from '@/lib/server/payment-requests-contract';
import { findPaymentRequestById } from '@/lib/server/payment-requests';
import { createAdminClient } from '@/lib/supabase/admin';

// Depende de la sesión de Clerk: no se puede prerenderizar.
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadAvailableBalance(userId: string): Promise<{ available: number; currency: string } | null> {
  const { data } = await createAdminClient()
    .from('client_balances')
    .select('balance, reserved_balance, currency')
    .eq('client_id', userId)
    .maybeSingle();

  if (!data) return null;
  return {
    available: Number(data.balance || 0) - Number(data.reserved_balance || 0),
    currency: data.currency || 'XAF',
  };
}

export default async function PayPaymentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checkoutPath = `/pay/${encodeURIComponent(id)}`;
  const { user, serviceUnavailable, needsOnboarding } = await getOptionalAuthState();

  if (serviceUnavailable) return <ServiceUnavailableScreen retryHref={checkoutPath} />;
  if (needsOnboarding) redirect('/onboarding');
  if (!user) redirect(`/login?redirect_url=${encodeURIComponent(checkoutPath)}`);

  const paymentRequest = UUID_PATTERN.test(id) ? await findPaymentRequestById(id) : null;
  if (!paymentRequest) {
    return (
      <ErrorScreen
        badge="404"
        title="Solicitud no encontrada"
        description="Este enlace de pago no existe o ya no es válido. Vuelve a la aplicación del comercio e inicia el pago otra vez."
        actions={[{ href: '/dashboard', label: 'Ir a mi billetera' }]}
      />
    );
  }

  const balance = await loadAvailableBalance(user.id);

  return (
    <PaymentRequestCheckout
      requestId={paymentRequest.id}
      merchantName={paymentRequest.merchant_name}
      amount={Number(paymentRequest.amount)}
      currency={paymentRequest.currency}
      description={paymentRequest.description}
      reference={paymentRequest.payment_reference || paymentRequest.external_reference}
      externalReference={paymentRequest.external_reference}
      status={resolvePaymentRequestStatus(paymentRequest.status, paymentRequest.expires_at)}
      expiresAt={paymentRequest.expires_at}
      returnUrl={paymentRequest.return_url}
      isOwnRequest={paymentRequest.merchant_user_id === user.id}
      availableBalance={balance?.available ?? 0}
      walletCurrency={balance?.currency ?? paymentRequest.currency}
    />
  );
}
