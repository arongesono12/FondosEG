import { createAdminClient } from '@/lib/supabase/admin';
import type { WalletTransfer, CreateWalletTransferData, ConfirmWalletTransferData } from '@/types';
import { queueWalletConfirmationInternal } from '@/lib/server/notification-outbox';
import { emitWebhookEvent } from '@/lib/server/webhook-outbox';
import { PAYMENT_REGULATION } from '@/lib/compliance';
import { getAvailableClientBalance } from '@/lib/financial';
import { assertComplianceInfrastructure } from '@/lib/server/compliance-events';
import { getPhoneLookupCandidates, normalizePhoneDigits } from '@/lib/utils';
import {
  cancelWalletTransferOperation,
  confirmWalletTransferOperation,
  createWalletTransferSettledOperation,
  releaseExpiredClientWithdrawals,
  releaseExpiredWalletTransfers,
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
    [/receiver is not a valid client/i, 'El destinatario no es un cliente válido'],
    [/sender is not a valid client/i, 'Sólo los clientes pueden enviar dinero desde la billetera'],
    // El código se despliega antes que la migración con más frecuencia de la
    // que uno quisiera. Sin esta entrada, la RPC ausente cae en el mensaje de
    // reserva y el emisor lee "inténtalo de nuevo" ante algo que sólo se
    // arregla aplicando la migración.
    [
      /could not find the function/i,
      'La base de datos todavía no tiene aplicada la última migración. Avisa a soporte: reintentar no lo va a resolver.',
    ],
    [
      /receiver account is not active/i,
      'La cuenta del destinatario no está activa, así que no podría cobrar el envío',
    ],
    // Violación de clave foránea: el emisor o el beneficiario no existen para
    // la restricción de `wallet_transfers`. Es un defecto de esquema, no algo
    // que el usuario pueda arreglar, así que NO se le puede decir que
    // reintente: el mensaje de reserva («inténtalo de nuevo») convirtió este
    // fallo en un callejón sin salida hasta que se reprodujo contra la base
    // de datos. Ver 20260824_wallet_transfers_fk_repoint_to_public_users.sql.
    [
      /violates foreign key constraint/i,
      'Tu cuenta o la del beneficiario no está correctamente registrada en la base de datos. Avisa a soporte: reintentar no lo va a resolver.',
    ],
  ];
  for (const [pattern, message] of table) {
    if (pattern.test(raw)) return message;
  }
  return fallback;
}

/**
 * Resuelve el emisor y el beneficiario de cada transferencia.
 *
 * Se hace con una consulta explícita en lugar del embed
 * `users!wallet_transfers_sender_id_fkey(...)`, que responde PGRST200 mientras
 * las claves foráneas no apunten a `public.users`. La tabla desplegada las
 * tenía apuntando a `auth.users` —lo que además impedía crear cualquier
 * transferencia, ver
 * `20260824_wallet_transfers_fk_repoint_to_public_users.sql`—, y una consulta
 * explícita funciona igual antes y después de esa corrección.
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

/**
 * Barre las órdenes caducadas antes de leer, crear o confirmar.
 *
 * Una orden caducada sigue restando saldo disponible hasta que alguien libera
 * su retención, y nada lo hace por su cuenta: no hay tarea programada. Se barre
 * en cada punto por el que pasa el flujo, igual que ya se hacía con los códigos
 * de retiro caducados. No puede hacer fallar a quien lo invoca: en el peor caso
 * se sigue viendo retenido un importe que ya nadie puede cobrar, que es
 * exactamente el estado anterior.
 */
async function sweepExpiredWalletTransfers(clientId?: string | null): Promise<void> {
  try {
    await releaseExpiredWalletTransfers(clientId ?? null);
  } catch (expiryError) {
    console.error('No se pudieron liberar las órdenes de billetera caducadas:', expiryError);
  }
}

/**
 * Comprueba que el beneficiario podría entrar a cobrar la orden.
 *
 * Tener ficha en `users` no basta. Si la cuenta está desactivada o su acceso al
 * panel no está en `active`, no puede iniciar sesión para confirmar, y el
 * importe se quedaría retenido en la billetera del emisor hasta caducar. Se
 * exige lo MISMO que exige el inicio de sesión, `requireProductAccess('dashboard')`.
 *
 * Ante un error de lectura devuelve `true` a propósito: la misma regla está
 * replicada dentro de `create_wallet_transfer_hold`, que es quien manda. Fallar
 * cerrado aquí bloquearía envíos legítimos por una incidencia pasajera sin
 * ganar nada.
 */
async function canReceiveWalletTransfer(
  adminClient: AdminClient,
  receiver: { id: string; is_active?: boolean | null }
): Promise<boolean> {
  if (receiver.is_active === false) return false;

  const { data, error } = await adminClient
    .from('account_access')
    .select('status')
    .eq('user_id', receiver.id)
    .eq('product', 'dashboard')
    .maybeSingle();

  if (error) {
    console.error('No se pudo comprobar el acceso del destinatario:', error);
    return true;
  }

  return data?.status === 'active';
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

  // Los códigos de retiro y las órdenes de billetera caducados siguen
  // reteniendo saldo hasta que se liberan. Sin este barrido, un vale que el
  // emisor nunca llegó a cobrar —o un envío que el beneficiario nunca
  // confirmó— le bloquearía sus propios envíos con un "Saldo insuficiente" que
  // ya no responde a ninguna orden viva.
  try {
    await releaseExpiredClientWithdrawals(senderId);
  } catch (expiryError) {
    console.error('No se pudieron liberar los retiros caducados:', expiryError);
  }

  await sweepExpiredWalletTransfers(senderId);

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

  if (!(await canReceiveWalletTransfer(adminClient, receiver))) {
    return {
      success: false,
      error: 'La cuenta del destinatario no está activa, así que no podría cobrar el envío',
    };
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

  // Todo pasa por `create_wallet_transfer_settled_operation`: en UNA sola
  // transacción bloquea las dos filas de saldo, debita al emisor, abona al
  // beneficiario, inserta la orden ya `confirmed` y deja los dos asientos
  // contables junto con la evidencia de consentimiento.
  //
  // No hay código ni retención. El envío entre clientes se entrega en el acto,
  // igual que el de un gestor a un cliente registrado: el beneficiario ya está
  // identificado, así que no hace falta un vale al portador que alguien tenga
  // que presentar. El vale sigue existiendo sólo donde tiene sentido, en
  // `client_withdrawals`, cuando un cliente quiere sacar en efectivo su propio
  // saldo.
  let transfer: WalletTransfer;
  try {
    const result = await createWalletTransferSettledOperation({
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
      // El envoltorio ya normaliza `undefined` a NULL antes de la RPC.
      notes: data.notes,
      originChannel: 'dashboard',
      regulationCode: PAYMENT_REGULATION.code,
      disclosureVersion: PAYMENT_REGULATION.disclosureVersion,
      consentChannel: 'dashboard_wallet',
      ipAddress: requestEvidence?.ipAddress,
      userAgent: requestEvidence?.userAgent,
    });
    transfer = result.transfer as unknown as WalletTransfer;
  } catch (settleError) {
    console.error('No se pudo registrar la transferencia de billetera:', settleError);
    return {
      success: false,
      error: translateRpcError(settleError, 'No se pudo registrar la transferencia. Inténtalo de nuevo.'),
    };
  }

  // El dinero ya está en su billetera, así que el aviso lo dice y no pide
  // ningún código.
  try {
    await queueWalletConfirmationInternal({
      transferId: transfer.id,
      phone: receiver.phone,
      senderName: sender.name,
      receiverName: data.receiver_name,
      amount,
      currency,
    });
  } catch (notifErr) {
    console.error('Failed to queue wallet settlement notice:', notifErr);
  }

  // Para un integrador, este envío ya está completado: si no se emitiera aquí,
  // los envíos del panel dejarían de aparecer en `wallet_transfer.confirmed`,
  // que hasta ahora los recogía al confirmarse.
  try {
    await emitWebhookEvent(
      {
        eventType: 'wallet_transfer.confirmed',
        payload: {
          transfer_id: transfer.id,
          amount: Number(transfer.amount),
          currency: transfer.currency,
          status: transfer.status,
          sender_name: transfer.sender_name,
          sender_phone: transfer.sender_phone,
          receiver_name: transfer.receiver_name,
          receiver_phone: transfer.receiver_phone,
          confirmed_at: transfer.confirmed_at ?? null,
          source: 'dashboard_wallet',
        },
      },
      10
    );
  } catch (webhookErr) {
    console.error('Failed to dispatch wallet settlement webhook:', webhookErr);
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

  // Si la orden ya caducó, el barrido la marca y devuelve su importe al emisor.
  // La RPC la rechaza después con "Transfer has expired", que es el motivo real
  // y no un genérico "ya no está pendiente".
  await sweepExpiredWalletTransfers();

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

  await sweepExpiredWalletTransfers();

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

  await sweepExpiredWalletTransfers(clientId);

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
