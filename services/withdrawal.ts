import 'server-only';

import { randomInt } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ClientWithdrawal, CreateClientWithdrawalData } from '@/types';
import { CLIENT_WITHDRAWAL_EXPIRY_HOURS, getAvailableClientBalance } from '@/lib/financial';
import {
  cancelClientWithdrawalOperation,
  createClientWithdrawalOperation,
  payOutClientWithdrawalOperation,
  releaseExpiredClientWithdrawals,
} from '@/lib/server/financial-operations';
import { saveInternalNotification } from '@/lib/server/notification-outbox';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Retiros de efectivo iniciados por el cliente.
 *
 * Este módulo existe para que el saldo de un cliente registrado deje de
 * depender del código que genera el gestor al enviarle dinero. El dinero que
 * entra en la billetera es suyo desde el primer momento; cuando quiere
 * efectivo, es él quien emite el vale y elige en qué gestor lo presenta.
 */

/** Traduce los `RAISE EXCEPTION` de las RPC a mensajes para el usuario. */
function translateRpcError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const table: Array<[RegExp, string]> = [
    [/monto inv[aá]lido/i, 'El importe debe ser un número mayor que cero'],
    [/insufficient balance/i, 'Saldo disponible insuficiente para este retiro'],
    [/client balance not found/i, 'Tu billetera todavía no tiene saldo disponible'],
    [/currency mismatch/i, 'Tu billetera opera en otra divisa'],
    [/reserved balance is insufficient/i, 'Los fondos retenidos para este retiro ya no están disponibles'],
    [/withdrawal not found/i, 'No se ha encontrado el retiro'],
    [/withdrawal is not pending/i, 'Este código de retiro ya no está disponible'],
    [/withdrawal has expired/i, 'El código de retiro ha caducado. El cliente debe generar uno nuevo.'],
    [/withdrawal cannot be cancelled/i, 'Este retiro ya no se puede anular'],
    [/saldo en efectivo insuficiente/i, 'No tienes efectivo suficiente en caja para pagar este retiro'],
    [/saldo del gestor pagador no encontrado/i, 'No se ha encontrado tu saldo de gestor'],
  ];
  for (const [pattern, message] of table) {
    if (pattern.test(raw)) return message;
  }
  return fallback;
}

/**
 * El código es un vale al portador: quien lo presenta cobra.
 *
 * El generador pseudoaleatorio del lenguaje —el que usa `generateTransferCode`
 * para los envíos de ventanilla— no es un CSPRNG: su estado interno se puede
 * reconstruir observando salidas sucesivas, lo que permitiría predecir el
 * código de otro cliente a partir de códigos propios. Aquí se usa el generador
 * criptográfico del sistema.
 */
function generateWithdrawalCode(): string {
  const year = new Date().getFullYear();
  const random = randomInt(0, 1_000_000).toString().padStart(6, '0');
  return `RET-${year}-${random}`;
}

async function generateUniqueWithdrawalCode(adminClient: AdminClient): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateWithdrawalCode();
    const { data } = await adminClient
      .from('client_withdrawals')
      .select('id')
      .eq('withdrawal_code', code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error('No se pudo generar un código de retiro único');
}

export async function createClientWithdrawal(
  clientId: string,
  data: CreateClientWithdrawalData
): Promise<{ success: boolean; withdrawal?: ClientWithdrawal; error?: string }> {
  const adminClient = createAdminClient();

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'El importe debe ser un número mayor que cero' };
  }

  const { data: client, error: clientError } = await adminClient
    .from('users')
    .select('id, name, phone, role')
    .eq('id', clientId)
    .maybeSingle();

  if (clientError || !client) {
    return { success: false, error: 'No se ha encontrado tu perfil de usuario' };
  }

  if (client.role !== 'cliente') {
    return { success: false, error: 'Sólo los clientes pueden retirar efectivo de su billetera' };
  }

  // Se sanean primero los vales caducados: de otro modo su retención seguiría
  // restando saldo disponible a un retiro que sí se puede emitir.
  try {
    await releaseExpiredClientWithdrawals(clientId);
  } catch (expiryError) {
    console.error('No se pudieron liberar los retiros caducados:', expiryError);
  }

  const { data: balance, error: balanceError } = await adminClient
    .from('client_balances')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  if (balanceError) {
    console.error('No se pudo leer el saldo del cliente:', balanceError);
    return { success: false, error: 'No se pudo consultar tu saldo. Inténtalo de nuevo.' };
  }

  if (!balance) {
    return { success: false, error: 'Tu billetera todavía no tiene saldo disponible' };
  }

  const currency = balance.currency || 'XAF';
  if (data.currency && data.currency !== currency) {
    return {
      success: false,
      error: `Tu billetera opera en ${currency}, así que no es posible retirar en ${data.currency}`,
    };
  }

  // La RPC vuelve a comprobarlo con la fila bloqueada; esto se adelanta sólo
  // para dar un mensaje mejor que su excepción.
  const available = getAvailableClientBalance(
    Number(balance.balance),
    Number(balance.reserved_balance ?? 0)
  );
  if (available < amount) {
    return { success: false, error: 'Saldo disponible insuficiente para este retiro' };
  }

  try {
    const withdrawalCode = await generateUniqueWithdrawalCode(adminClient);
    const result = await createClientWithdrawalOperation({
      clientId,
      withdrawalCode,
      amount,
      currency,
      destinationCity: data.destination_city,
      notes: data.notes,
      expiresInHours: CLIENT_WITHDRAWAL_EXPIRY_HOURS,
    });

    const withdrawal = result.withdrawal as unknown as ClientWithdrawal;

    // Aviso interno al propio titular. A diferencia de las órdenes entre
    // billeteras, aquí el código SÍ va dirigido a quien lo recibe: es su vale.
    try {
      await saveInternalNotification({
        userId: clientId,
        phone: client.phone || '',
        priority: 'high',
        message: [
          `FondosEG: Has generado un código para retirar ${amount} ${currency} en efectivo.`,
          `Código de retiro: ${withdrawal.withdrawal_code}`,
          'Preséntalo junto con tu DIP en cualquier gestor autorizado.',
          'Mientras el código esté activo, el importe queda retenido en tu billetera.',
        ].join('\n'),
      });
    } catch (notifError) {
      console.error('No se pudo registrar la notificación del retiro:', notifError);
    }

    return { success: true, withdrawal };
  } catch (error) {
    console.error('No se pudo emitir el código de retiro:', error);
    return {
      success: false,
      error: translateRpcError(error, 'No se pudo generar el código de retiro. Inténtalo de nuevo.'),
    };
  }
}

export async function getClientWithdrawals(
  clientId: string,
  limit: number = 50
): Promise<ClientWithdrawal[]> {
  const adminClient = createAdminClient();

  try {
    await releaseExpiredClientWithdrawals(clientId);
  } catch (expiryError) {
    console.error('No se pudieron liberar los retiros caducados:', expiryError);
  }

  const { data, error } = await adminClient
    .from('client_withdrawals')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as ClientWithdrawal[];
}

export async function cancelClientWithdrawal(
  withdrawalId: string,
  actorUserId: string
): Promise<{ success: boolean; withdrawal?: ClientWithdrawal; error?: string }> {
  const adminClient = createAdminClient();

  const { data: withdrawal, error } = await adminClient
    .from('client_withdrawals')
    .select('*')
    .eq('id', withdrawalId)
    .maybeSingle();

  if (error) {
    console.error('No se pudo leer el retiro:', error);
    return { success: false, error: 'No se pudo consultar el retiro. Inténtalo de nuevo.' };
  }

  if (!withdrawal) {
    return { success: false, error: 'No se ha encontrado el retiro' };
  }

  // Sólo el titular anula su propio vale. La RPC no autoriza a nadie: usa
  // `p_actor_user_id` únicamente para el asiento.
  if (withdrawal.client_id !== actorUserId) {
    return { success: false, error: 'No estás autorizado a anular este retiro' };
  }

  try {
    const result = await cancelClientWithdrawalOperation(withdrawalId, actorUserId);
    return { success: true, withdrawal: result.withdrawal as unknown as ClientWithdrawal };
  } catch (cancelError) {
    console.error('No se pudo anular el retiro:', cancelError);
    return {
      success: false,
      error: translateRpcError(cancelError, 'No se pudo anular el retiro. Inténtalo de nuevo.'),
    };
  }
}

/**
 * Resuelve un código de retiro para el gestor que lo va a pagar.
 *
 * Devuelve también los datos identificativos del titular: el gestor tiene que
 * comprobar el DIP contra la persona que tiene delante antes de entregar nada.
 */
export async function lookupClientWithdrawal(
  code: string
): Promise<{ withdrawal: ClientWithdrawal | null; error?: string }> {
  const adminClient = createAdminClient();
  const normalized = code.trim().toUpperCase();

  if (!normalized) {
    return { withdrawal: null, error: 'Código requerido' };
  }

  try {
    await releaseExpiredClientWithdrawals(null);
  } catch (expiryError) {
    console.error('No se pudieron liberar los retiros caducados:', expiryError);
  }

  const { data, error } = await adminClient
    .from('client_withdrawals')
    .select('*')
    .eq('withdrawal_code', normalized)
    .maybeSingle();

  if (error) {
    console.error('No se pudo buscar el retiro:', error);
    return { withdrawal: null, error: 'No se pudo consultar el retiro. Inténtalo de nuevo.' };
  }

  if (!data) {
    return { withdrawal: null, error: 'Retiro no encontrado o no disponible' };
  }

  if (data.status !== 'pending') {
    return { withdrawal: null, error: 'Este código de retiro ya no está disponible' };
  }

  const { data: client } = await adminClient
    .from('users')
    .select('name, phone, document_type, document_number')
    .eq('id', data.client_id)
    .maybeSingle();

  return {
    withdrawal: {
      ...(data as ClientWithdrawal),
      client: client
        ? {
            name: client.name,
            phone: client.phone ?? undefined,
            document_type: client.document_type ?? undefined,
            document_number: client.document_number ?? undefined,
          }
        : undefined,
    },
  };
}

export async function payOutClientWithdrawal(
  withdrawalId: string,
  agentId: string
): Promise<{ success: boolean; withdrawal?: ClientWithdrawal; error?: string }> {
  const adminClient = createAdminClient();

  try {
    const result = await payOutClientWithdrawalOperation(withdrawalId, agentId);
    const withdrawal = result.withdrawal as unknown as ClientWithdrawal;

    try {
      const { data: agent } = await adminClient
        .from('users')
        .select('name')
        .eq('id', agentId)
        .maybeSingle();

      const { data: client } = await adminClient
        .from('users')
        .select('phone')
        .eq('id', withdrawal.client_id)
        .maybeSingle();

      await saveInternalNotification({
        userId: withdrawal.client_id,
        phone: client?.phone || '',
        priority: 'high',
        message: [
          `FondosEG: Se ha entregado tu retiro de ${withdrawal.amount} ${withdrawal.currency} en efectivo.`,
          `Código: ${withdrawal.withdrawal_code}`,
          `Gestor pagador: ${agent?.name || 'Gestor autorizado'}.`,
          'Si no reconoces esta operación, contacta con soporte inmediatamente.',
        ].join('\n'),
      });
    } catch (notifError) {
      console.error('No se pudo notificar el pago del retiro:', notifError);
    }

    return { success: true, withdrawal };
  } catch (error) {
    console.error('No se pudo pagar el retiro:', error);

    // La RPC no puede liberar la retención de un vale caducado: su
    // `RAISE EXCEPTION` deshace la transacción entera. El barrido sí confirma su
    // trabajo, así que se ejecuta aquí para que el importe vuelva a estar
    // disponible en la billetera del titular.
    if (error instanceof Error && /withdrawal has expired/i.test(error.message)) {
      try {
        await releaseExpiredClientWithdrawals(null);
      } catch (releaseError) {
        console.error('No se pudo liberar la retención del retiro caducado:', releaseError);
      }
    }

    return {
      success: false,
      error: translateRpcError(error, 'No se pudo completar el pago del retiro.'),
    };
  }
}
