/**
 * Eventos a los que un integrador puede suscribir un webhook.
 *
 * Fuente única para las rutas de suscripción y para la consola de
 * desarrolladores. Sin imports con alias para poder usarse en tests.
 */
export const SUBSCRIBABLE_WEBHOOK_EVENTS = [
  'transfer.created',
  'transfer.paid_out',
  'wallet_transfer.confirmed',
  'payment_request.paid',
  'payment_request.cancelled',
  'payment_request.payment_failed',
] as const;

export type SubscribableWebhookEvent = (typeof SUBSCRIBABLE_WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_DESCRIPTIONS: Record<SubscribableWebhookEvent, string> = {
  'transfer.created': 'Un gestor registró una transferencia.',
  'transfer.paid_out': 'Una transferencia se entregó en efectivo.',
  'wallet_transfer.confirmed': 'Una transferencia entre billeteras quedó liquidada.',
  'payment_request.paid': 'Un cliente pagó una solicitud de cobro tuya.',
  'payment_request.cancelled': 'El cliente rechazó o el comercio canceló una solicitud de cobro.',
  'payment_request.payment_failed':
    'Un cliente intentó pagar sin saldo suficiente. La solicitud sigue pendiente.',
};
