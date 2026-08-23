import { randomInt } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WalletTransfer, CreateWalletTransferData, ConfirmWalletTransferData } from '@/types';
import { queueWalletPendingNotice, queueWalletConfirmationInternal } from '@/lib/server/notification-outbox';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import { PAYMENT_REGULATION } from '@/lib/compliance';
import { getAvailableClientBalance } from '@/lib/financial';
import { assertComplianceInfrastructure, recordPaymentConsent } from '@/lib/server/compliance-events';
import { getPhoneLookupCandidates, normalizePhoneDigits } from '@/lib/utils';
import {
  cancelWalletTransferOperation,
  confirmWalletTransferOperation,
  createWalletTransferHold,
} from '@/lib/server/financial-operations';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Traduce los `RAISE EXCEPTION` de las RPC a mensajes para el usuario.
 *
 * Las funciones de PostgreSQL lanzan en inglés y sin contexto. Devolverlos tal
 * cual dejaría al emisor con un "Insufficient balance" delante de un flujo de
 * dinero en español.
 */
function translateRpcError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const table: Array<[RegExp, string]> = [
    [/monto inv[aá]lido/i, 'El importe debe ser un número mayor que cero'],
    [/insufficient balance/i, 'Saldo insuficiente para realizar esta transferencia'],
    [/sender balance not found/i, 'Tu billetera todavía no tiene saldo disponible'],
    [/reserved balance is insufficient/i, 'Los fondos retenidos para esta orden ya no están disponibles'],
    [/transfer not found/i, 'No se ha encontrado la transferencia'],
    [/transfer is not pending/i, 'Esta transferencia ya no está pendiente'],
    [/transfer has expired/i, 'La transferencia ha caducado'],
    [/invalid verification code/i, 'El código de verificación no es correcto'],
    [/transfer cannot be cancelled/i, 'Esta transferencia ya no se puede cancelar'],
  ];
  for (const [pattern, message] of table) {
    if (pattern.test(raw)) return message;
  }
  return fallback;
}

function generateVerificationCode(): string {
  // `Math.random()` no es un CSPRNG: su estado interno se puede reconstruir
  // observando salidas sucesivas, lo que permitiría predecir el código de una
  // orden ajena a partir de códigos propios.
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Resuelve el emisor y el beneficiario de cada transferencia.
 *
 * La tabla `wallet_transfers` desplegada no declara las claves foráneas hacia
 * `users`, así que PostgREST no puede resolver el embed
 * `users!wallet_transfers_sender_id_fkey(...)` y responde PGRST200. Una consulta
 * explícita funciona con y sin constraints, de modo que este código es inmune a
 * esa divergencia de esquema.
 */
async function attachParties(adminClient: AdminClient, transfers: WalletTransfer[]): Promise<WalletTransfer[]> {
  const ids = Array.from(
    new Set(
      transfers
        .flatMap((transfer) => [transfer.sender_id, transfer.receiver_id])
        .filter((id): id is string => Boolean(id))
    )
  );

  if (ids.length === 0) return transfers;

  const { data: users, error } = await adminClient
    .from('users')
    .select('id, name, phone')
    .in('id', ids);

  if (error) {
    console.error('No se pudieron resolver las partes de la transferencia:', error);
    return transfers;
  }

  const byId = new Map(
    (users || []).map((user) => [user.id, { name: user.name, phone: user.phone ?? undefined }])
  );

  return transfers.map((transfer) => ({
    ...transfer,
    sender: byId.get(transfer.sender_id),
    receiver: byId.get(transfer.receiver_id),
  }));
}

/**
 * Localiza a un cliente por teléfono tolerando diferencias de formato.
 *
 * El mismo número se almacena como `+240 XXXXXXXXX` cuando viene de
 * `PhoneInput` y como `+240XXXXXXXXX` cuando viene de otras altas, así que la
 * igualdad exacta deja fuera a destinatarios que sí existen. Se aplica el mismo
 * criterio que en `app/api/transfers/route.ts`: primero los formatos candidatos
 * y, si ninguno encaja, comparación por dígitos normalizados.
 */
async function findClientByPhone(adminClient: AdminClient, phone: string) {
  const normalizedInput = normalizePhoneDigits(phone || '');
  if (!normalizedInput) return null;

  const lookupCandidates = getPhoneLookupCandidates(phone);
  if (lookupCandidates.length > 0) {
    const { data } = await adminClient
      .from('users')
      .select('*')
      .eq('role', 'cliente')
      .in('phone', lookupCandidates)
      .limit(10);

    const exactMatch = (data || []).find(
      (user) => normalizePhoneDigits(user.phone || '') === normalizedInput
    );
    if (exactMatch) return exactMatch;
  }

  // Deliberadamente no se devuelve "el primer candidato" cuando la comparación
  // por dígitos falla: en un flujo de dinero, enviar al usuario equivocado es
  // peor que no encontrar a nadie.
  const { data: fallbackUsers } = await adminClient
    .from('users')
    .select('*')
    .eq('role', 'cliente');

  return (fallbackUsers || []).find(
    (user) => normalizePhoneDigits(user.phone || '') === normalizedInput
  ) ?? null;
}

export async function createWalletTransfer(
  senderId: string,
  data: CreateWalletTransferData,
  requestEvidence?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<{ success: boolean; transfer?: WalletTransfer; error?: string }> {
  const adminClient = createAdminClient();

  if (
    data.compliance_consent !== true ||
    data.disclosure_version !== PAYMENT_REGULATION.disclosureVersion
  ) {
    return { success: false, error: 'Debe revisar y aceptar la información previa del servicio de pago' };
  }

  // El cliente valida el importe, pero la ruta es invocable directamente.
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'El importe debe ser un número mayor que cero' };
  }

  await assertComplianceInfrastructure();

  const { data: sender, error: senderError } = await adminClient
    .from('users')
    .select('*')
    .eq('id', senderId)
    .maybeSingle();

  if (senderError || !sender) {
    return { success: false, error: 'No se ha encontrado tu perfil de usuario' };
  }

  if (sender.role !== 'cliente') {
    return { success: false, error: 'Sólo los clientes pueden enviar dinero desde la billetera' };
  }

  // `users.phone` admite NULL desde la migración a Clerk, pero
  // `wallet_transfers.sender_phone` sigue siendo NOT NULL: sin esta comprobación
  // el INSERT falla con un error de constraint que no le dice nada al usuario.
  if (!sender.phone?.trim()) {
    return { success: false, error: 'Añade tu número de teléfono en tu perfil antes de enviar dinero' };
  }

  const receiver = await findClientByPhone(adminClient, data.receiver_phone);

  if (!receiver) {
    return { success: false, error: 'No existe ningún cliente registrado con ese número de teléfono' };
  }

  if (receiver.id === senderId) {
    return { success: false, error: 'No puedes enviarte dinero a ti mismo' };
  }

  // `client_balances.client_id` es UNIQUE: hay como mucho una fila por cliente.
  // Se consulta directamente en lugar de embeberla en `users`, porque PostgREST
  // trata esa relación como uno-a-uno y devuelve un objeto, no un array — que es
  // lo que hacía fallar al flujo entero con un TypeError.
  const { data: senderBalance, error: senderBalanceError } = await adminClient
    .from('client_balances')
    .select('*')
    .eq('client_id', senderId)
    .maybeSingle();

  if (senderBalanceError) {
    console.error('No se pudo leer el saldo del emisor:', senderBalanceError);
    return { success: false, error: 'No se pudo consultar tu saldo. Inténtalo de nuevo.' };
  }

  if (!senderBalance) {
    return { success: false, error: 'Tu billetera todavía no tiene saldo disponible' };
  }

  // La billetera opera en una única divisa. No hay conversión en ninguna capa,
  // así que aceptar otra divisa movería importes con el valor equivocado.
  const currency = senderBalance.currency || 'XAF';
  if (data.currency && data.currency !== currency) {
    return {
      success: false,
      error: `Tu billetera opera en ${currency}, así que no es posible enviar en ${data.currency}`,
    };
  }

  // Saldo DISPONIBLE, no saldo bruto: lo ya retenido por otras órdenes
  // pendientes no se puede volver a comprometer. Es la misma cuenta que hace
  // la RPC; se adelanta aquí sólo para dar un mensaje mejor que su excepción.
  const availableBalance = getAvailableClientBalance(
    Number(senderBalance.balance),
    Number(senderBalance.reserved_balance ?? 0)
  );
  if (availableBalance < amount) {
    return { success: false, error: 'Saldo insuficiente para realizar esta transferencia' };
  }

  const verificationCode = generateVerificationCode();

  // La creación pasa por `create_wallet_transfer_hold`: en una sola transacción
  // bloquea la fila del saldo (`FOR UPDATE`), retiene el importe en
  // `reserved_balance`, inserta la orden y deja el asiento en
  // `financial_events`. Hacerlo a mano —como antes— permitía que dos órdenes
  // simultáneas del mismo emisor superasen su saldo, porque ninguna veía la
  // retención de la otra.
  let transfer: WalletTransfer;
  try {
    const result = await createWalletTransferHold({
      senderId,
      receiverId: receiver.id,
      senderName: sender.name,
      senderPhone: sender.phone,
      receiverName: data.receiver_name,
      // Se guarda el teléfono canónico del beneficiario, no el que se tecleó,
      // para que el registro no herede el formato de entrada.
      receiverPhone: receiver.phone ?? data.receiver_phone,
      amount,
      currency,
      verificationCode,
      // El envoltorio ya normaliza `undefined` a NULL antes de la RPC.
      notes: data.notes,
      originChannel: 'dashboard',
    });
    transfer = result.transfer as unknown as WalletTransfer;
  } catch (holdError) {
    console.error('No se pudo registrar la transferencia de billetera:', holdError);
    return {
      success: false,
      error: translateRpcError(holdError, 'No se pudo registrar la transferencia. Inténtalo de nuevo.'),
    };
  }

  try {
    await recordPaymentConsent({
      actorUserId: senderId,
      transferId: transfer.id,
      transferType: 'wallet_transfer',
      amount: Number(transfer.amount),
      currency: transfer.currency,
      feeAmount: 0,
      beneficiaryName: transfer.receiver_name,
      channel: 'dashboard_wallet',
      ipAddress: requestEvidence?.ipAddress,
      userAgent: requestEvidence?.userAgent,
    });
  } catch (consentError) {
    // La evidencia de consentimiento es un requisito regulatorio. Si no se puede
    // dejar constancia, la orden no puede quedarse viva y cobrable 24 horas
    // mientras el emisor ve un error y cree que no ha pasado nada.
    console.error('No se pudo registrar el consentimiento de pago:', consentError);
    // Se anula por la RPC, no con un UPDATE de `status`: ahora hay fondos
    // RETENIDOS detrás de la orden. Marcarla como anulada sin liberar la
    // reserva dejaría ese importe bloqueado en la billetera del emisor para
    // siempre, sin ninguna orden viva que lo justifique.
    try {
      await cancelWalletTransferOperation(transfer.id, senderId);
    } catch (releaseError) {
      console.error('No se pudo liberar la retención de la orden anulada:', releaseError);
    }
    return {
      success: false,
      error: 'No se pudo registrar la evidencia de consentimiento. La orden ha sido anulada.',
    };
  }

  // Aviso al beneficiario, deliberadamente SIN el código: es el emisor quien lo
  // custodia y lo entrega en mano. Ver `queueWalletPendingNotice`.
  try {
    await queueWalletPendingNotice({
      transferId: transfer.id,
      phone: receiver.phone,
      senderName: sender.name,
      receiverName: data.receiver_name,
      amount,
      currency,
    });
  } catch (notifErr) {
    console.error('Failed to queue wallet pending notice:', notifErr);
  }

  return { success: true, transfer };
}

export async function confirmWalletTransfer(
  data: ConfirmWalletTransferData,
  actorUserId: string
): Promise<{ success: boolean; transfer?: WalletTransfer; error?: string }> {
  const adminClient = createAdminClient();

  if (!data.transfer_id) {
    return { success: false, error: 'Selecciona la transferencia que quieres confirmar' };
  }

  const { data: transfer, error: transferError } = await adminClient
    .from('wallet_transfers')
    .select('*')
    .eq('id', data.transfer_id)
    .maybeSingle();

  if (transferError) {
    console.error('No se pudo leer la transferencia:', transferError);
    return { success: false, error: 'No se pudo consultar la transferencia. Inténtalo de nuevo.' };
  }

  if (!transfer) {
    return { success: false, error: 'No se ha encontrado la transferencia' };
  }

  // Sólo el beneficiario puede liquidar la orden. Sin esta comprobación
  // cualquier usuario autenticado podía confirmar la transferencia de otro.
  if (transfer.receiver_id !== actorUserId) {
    return { success: false, error: 'No estás autorizado a confirmar esta transferencia' };
  }

  // A partir de aquí manda `confirm_wallet_transfer_operation`. En UNA sola
  // transacción bloquea las dos filas de saldo (`FOR UPDATE`), comprueba
  // estado, caducidad, código y retención, debita al emisor, abona al
  // beneficiario, marca la orden y escribe los dos asientos contables.
  //
  // Lo anterior era una secuencia de UPDATE sueltos con compensación a mano:
  // si el abono fallaba tras el débito, se intentaba devolver el dinero con
  // otra escritura que también podía fallar, y entonces el importe
  // desaparecía. Aquí o se hace todo o no se hace nada.
  //
  // La comprobación de que el actor es el beneficiario se queda ARRIBA, en
  // este servicio: la RPC usa `p_actor_user_id` sólo para el asiento y no
  // autoriza a nadie.
  let claimed: WalletTransfer;
  try {
    const result = await confirmWalletTransferOperation(
      transfer.id,
      data.verification_code ?? null,
      actorUserId
    );
    claimed = result.transfer as unknown as WalletTransfer;
  } catch (rpcError) {
    console.error('No se pudo confirmar la transferencia:', rpcError);
    return {
      success: false,
      error: translateRpcError(rpcError, 'No se pudo completar la transferencia. Vuelve a intentarlo.'),
    };
  }

  const [confirmedTransfer] = await attachParties(adminClient, [claimed as WalletTransfer]);

  // Queue Confirmation Notification (Internal only, no SMS)
  try {
    await queueWalletConfirmationInternal({
      transferId: confirmedTransfer.id,
      phone: confirmedTransfer.receiver?.phone ?? confirmedTransfer.receiver_phone,
      senderName: confirmedTransfer.sender?.name ?? confirmedTransfer.sender_name,
      receiverName: confirmedTransfer.receiver_name,
      amount: confirmedTransfer.amount,
      currency: confirmedTransfer.currency,
    });
  } catch (notifErr) {
    console.error('Failed to queue wallet confirmation notification:', notifErr);
  }

  try {
    await emitWebhookEvent(
      {
        eventType: 'wallet_transfer.confirmed',
        payload: {
          transfer_id: confirmedTransfer.id,
          amount: confirmedTransfer.amount,
          currency: confirmedTransfer.currency,
          status: confirmedTransfer.status,
          sender_name: confirmedTransfer.sender?.name ?? confirmedTransfer.sender_name,
          sender_phone: confirmedTransfer.sender?.phone ?? confirmedTransfer.sender_phone,
          receiver_name: confirmedTransfer.receiver_name,
          receiver_phone: confirmedTransfer.receiver?.phone ?? confirmedTransfer.receiver_phone,
          confirmed_at: confirmedTransfer.confirmed_at ?? null,
          source: 'wallet_confirmation',
        },
      },
      10
    );
  } catch (webhookErr) {
    console.error('Failed to dispatch wallet confirmation webhook:', webhookErr);
  }

  return { success: true, transfer: confirmedTransfer };
}

export async function getWalletTransfer(transferId: string): Promise<WalletTransfer | null> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('wallet_transfers')
    .select('*')
    .eq('id', transferId)
    .maybeSingle();

  if (error || !data) return null;

  const [transfer] = await attachParties(adminClient, [data as WalletTransfer]);
  return transfer;
}

/**
 * Oculta el código de confirmación en las filas que no pertenecen al emisor.
 *
 * El código es un vale al portador: quien lo tiene puede cobrar la orden. Como
 * los listados devolvían `select('*')`, el beneficiario podía leer en la
 * respuesta HTTP el mismo código que se supone que el emisor le entrega en mano,
 * y liquidar sin que se lo hubieran dado. El modelo sólo se sostiene si el
 * código no sale nunca hacia el beneficiario.
 */
function redactCodeForNonSender(transfers: WalletTransfer[], viewerId: string): WalletTransfer[] {
  return transfers.map((transfer) => {
    if (transfer.sender_id === viewerId) return transfer;
    const withheld = { ...transfer };
    delete withheld.verification_code;
    return withheld;
  });
}

export async function getPendingWalletTransfers(userId: string): Promise<WalletTransfer[]> {
  const adminClient = createAdminClient();

  // Consulta orientada al beneficiario: el código no se selecciona siquiera, de
  // modo que no puede escaparse por esta vía ni por descuido de un cambio futuro.
  const { data, error } = await adminClient
    .from('wallet_transfers')
    .select(
      'id, sender_id, receiver_id, sender_name, sender_phone, receiver_name, receiver_phone, amount, currency, status, notes, created_at, confirmed_at, expires_at'
    )
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('No se pudieron leer las transferencias pendientes:', error);
    return [];
  }

  return attachParties(adminClient, (data || []) as WalletTransfer[]);
}

export async function getClientWalletTransfers(clientId: string): Promise<WalletTransfer[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('wallet_transfers')
    .select('*')
    .or(`sender_id.eq.${clientId},receiver_id.eq.${clientId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('No se pudo leer el historial de billetera:', error);
    return [];
  }

  // El emisor sí conserva su código: lo necesita para entregarlo si cerró el
  // diálogo antes de hacerlo. El beneficiario nunca lo ve.
  const transfers = await attachParties(adminClient, (data || []) as WalletTransfer[]);
  return redactCodeForNonSender(transfers, clientId);
}

export async function cancelWalletTransfer(
  transferId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient();

  const { data: transfer, error: transferError } = await adminClient
    .from('wallet_transfers')
    .select('*')
    .eq('id', transferId)
    .maybeSingle();

  if (transferError) {
    console.error('No se pudo leer la transferencia a cancelar:', transferError);
    return { success: false, error: 'No se pudo consultar la transferencia. Inténtalo de nuevo.' };
  }

  if (!transfer) {
    return { success: false, error: 'No se ha encontrado la transferencia' };
  }

  if (transfer.sender_id !== userId) {
    return { success: false, error: 'No estás autorizado a cancelar esta transferencia' };
  }

  if (transfer.status !== 'pending') {
    return { success: false, error: 'Esta transferencia ya no se puede cancelar' };
  }

  // La anulación va por `cancel_wallet_transfer_operation`: además de marcar
  // la orden, LIBERA la retención de `reserved_balance` y deja el asiento
  // contable, todo en la misma transacción. Un UPDATE de `status` a secas
  // dejaría el importe bloqueado en la billetera del emisor sin ninguna orden
  // viva que lo respaldase. La RPC escribe también `cancelled_at`, que ya
  // existe en la tabla.
  try {
    await cancelWalletTransferOperation(transferId, userId);
  } catch (rpcError) {
    console.error('No se pudo cancelar la transferencia:', rpcError);
    return {
      success: false,
      error: translateRpcError(rpcError, 'No se pudo cancelar la transferencia. Inténtalo de nuevo.'),
    };
  }

  return { success: true };
}
