import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PAYMENT_REGULATION } from '@/lib/compliance';
import { isAllowedSameOriginMutation } from '@/lib/security/request-policy';
import { AuthzError, requireDashboardAccess, requireProfile } from '@/lib/server/authz';
import { resolvePaymentRequestStatus } from '@/lib/server/payment-requests-contract';
import {
  cancelPendingPaymentRequest,
  emitPaymentRequestEvent,
  findPaymentRequestById,
  payPaymentRequest,
  paymentFailureReason,
  phonesMatch,
  translatePayError,
} from '@/lib/server/payment-requests';

/**
 * Acción del cliente sobre una solicitud de cobro desde la página `/pay/[id]`:
 * pagarla desde su billetera o rechazarla. Requiere sesión; la API key del
 * comercio nunca puede ejecutar el pago.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pay'),
    compliance_consent: z.literal(true),
    disclosure_version: z.literal(PAYMENT_REGULATION.disclosureVersion),
  }),
  z.object({ action: z.literal('decline') }),
]);

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
    // El perfil (no solo la identidad) aporta el teléfono y rechaza cuentas desactivadas.
    const user = await requireProfile();
    await requireDashboardAccess();
    const { id } = await routeContext.params;

    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!UUID_PATTERN.test(id) || !parsed.success) {
      return NextResponse.json(
        { error: 'Debes revisar y aceptar la información del pago antes de confirmarlo' },
        { status: 400 }
      );
    }

    const paymentRequest = await findPaymentRequestById(id);
    if (!paymentRequest) {
      return NextResponse.json({ error: 'La solicitud de cobro no existe' }, { status: 404 });
    }

    if (resolvePaymentRequestStatus(paymentRequest.status, paymentRequest.expires_at) !== 'pending') {
      return NextResponse.json({ error: 'Esta solicitud ya no está pendiente' }, { status: 409 });
    }

    // Si el comercio dirigió la solicitud a un teléfono, solo ese cliente puede
    // rechazarla (el pago lo vuelve a comprobar la RPC en la misma transacción).
    if (!phonesMatch(paymentRequest.payer_phone, user.phone)) {
      return NextResponse.json({ error: 'Esta solicitud de cobro está dirigida a otro cliente' }, { status: 403 });
    }

    if (parsed.data.action === 'decline') {
      const cancelled = await cancelPendingPaymentRequest(id, {});
      if (!cancelled) {
        return NextResponse.json({ error: 'Esta solicitud ya no está pendiente' }, { status: 409 });
      }
      await emitPaymentRequestEvent('payment_request.cancelled', cancelled);
      return NextResponse.json({ success: true, status: 'cancelled', return_url: cancelled.return_url });
    }

    let paid;
    try {
      paid = await payPaymentRequest({
        requestId: id,
        payerId: user.id,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: request.headers.get('user-agent'),
      });
    } catch (payError) {
      console.error('Payment request pay failed:', payError);
      const failureReason = paymentFailureReason(payError);
      if (failureReason) {
        await emitPaymentRequestEvent('payment_request.payment_failed', paymentRequest, {
          failure_reason: failureReason,
        });
      }
      return NextResponse.json({ error: translatePayError(payError) }, { status: 400 });
    }

    await emitPaymentRequestEvent('payment_request.paid', paid);
    return NextResponse.json({
      success: true,
      status: 'paid',
      wallet_transfer_id: paid.wallet_transfer_id,
      return_url: paid.return_url,
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Payment request action error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
