import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

async function load(path: string): Promise<string> {
  return stripComments(await readFile(new URL(path, root), 'utf8'));
}

const ops = () => load('lib/server/financial-operations.ts');

// ---------------------------------------------------------------------------
// Atomicidad contable — todo movimiento de dinero es una RPC
// ---------------------------------------------------------------------------

test('toda operación financiera es una RPC, nunca una composición de updates', async () => {
  const source = await ops();

  const rpcCalls = source.match(/adminClient\.rpc\('([a-z_]+)'/g) ?? [];
  assert.ok(rpcCalls.length >= 10, `se esperaban ≥10 RPC, se hallaron ${rpcCalls.length}`);

  const rpcNames = rpcCalls.map((r) => r.match(/'([a-z_]+)'/)![1]);
  for (const name of rpcNames) {
    assert.match(name, /_operation$|_hold$|api_rate_limit|idempotency|release_/, `${name} no es una RPC de movimiento`);
    assert.ok(!name.startsWith('update_'), `nada se llama update_: no se componen updates`);
  }
});

test('las operaciones que mueven dinero usan RPC atómicas con nombres _operation', async () => {
  const source = await ops();

  for (const fn of [
    'create_agent_transfer_operation',
    'pay_out_agent_transfer_operation',
    'create_wallet_transfer_settled_operation',
    'create_wallet_transfer_direct_operation',
    'create_client_withdrawal_operation',
    'pay_out_client_withdrawal_operation',
  ]) {
    assert.ok(source.includes(`'${fn}'`), `falta la RPC ${fn}`);
  }
});

test('ninguna RPC de dinero se ejecuta sin que la capa superior pueda traducir su error', async () => {
  // La operación envuelve los errores en RpcError para que la capa superior
  // decida cómo traducirlos, y conserva code/detail/hint como diagnóstico.
  assert.match(await ops(), /class RpcError extends Error/);
  assert.match(await ops(), /this\.code = error\.code/);
});

// ---------------------------------------------------------------------------
// Traducción de errores SQL
// ---------------------------------------------------------------------------

test('los errores de RPC conservan code/detail/hint para diagnóstico', async () => {
  const source = await ops();

  assert.match(source, /code=\$\{error\.code\}/);
  assert.match(source, /details=\$\{error\.details\}/);
  assert.match(source, /hint=\$\{error\.hint\}/);
});

// ---------------------------------------------------------------------------
// Liquidación en billetera
// ---------------------------------------------------------------------------

test('el envío entre clientes se liquida en el acto con creación *settled*', async () => {
  const source = await ops();

  assert.match(source, /createWalletTransferSettledOperation/);
  assert.match(source, /create_wallet_transfer_settled_operation/);
  // El modelo de vale por código se conserva como RPC heredada para liquidar
  // órdenes antiguas, pero nada nuevo lo invoca desde la operación: no hay
  // `await createWalletTransferHold({` en la capa de operaciones.
  assert.doesNotMatch(source, /await createWalletTransferHold\(\{/);
});

test('la evidencia de consentimiento navega como argumento de la RPC de liquidación', async () => {
  const source = await ops();

  assert.match(source, /regulationCode/);
  assert.match(source, /disclosureVersion/);
  assert.match(source, /consentChannel/);
  assert.match(source, /p_regulation_code/);
  assert.match(source, /p_disclosure_version/);
});

test('la operación directa por teléfono (sin código) se apoya en la RPC direct', async () => {
  const source = await ops();

  assert.match(source, /createWalletTransferDirectOperation/);
  assert.match(source, /create_wallet_transfer_direct_operation/);
  assert.match(source, /originChannel \?\? 'external_api'/);
});

// ---------------------------------------------------------------------------
// Retiros de efectivo
// ---------------------------------------------------------------------------

test('el retiro retiene contra el saldo disponible y devuelve reserved_balance', async () => {
  const source = await ops();

  assert.match(source, /createClientWithdrawalOperation/);
  assert.match(source, /create_client_withdrawal_operation/);
  assert.match(source, /p_expires_in_hours/);
  assert.match(source, /reserved_balance/);
  assert.match(source, /available_balance/);
});

test('el pago del retiro mueve cliente y caja del agente en una sola RPC', async () => {
  const source = await ops();

  assert.match(source, /payOutClientWithdrawalOperation/);
  assert.match(source, /pay_out_client_withdrawal_operation/);
  assert.match(source, /client_reserved_balance/);
  assert.match(source, /agent_new_balance/);
  assert.match(source, /agent_new_cash/);
});

test('hay un barrido que libera las retenciones caducadas', async () => {
  const source = await ops();

  assert.match(source, /releaseExpiredClientWithdrawals/);
  assert.match(source, /release_expired_client_withdrawals/);
  assert.match(source, /releaseExpiredWalletTransfers/);
  assert.match(source, /release_expired_wallet_transfers/);
});

test('un cliente puede anular su retiro y devolver la retención a disponible', async () => {
  const source = await ops();

  assert.match(source, /cancelClientWithdrawalOperation/);
  assert.match(source, /cancel_client_withdrawal_operation/);
  assert.match(source, /available_balance/);
  assert.match(source, /reserved_balance/);
});

// ---------------------------------------------------------------------------
// Envío de gestor
// ---------------------------------------------------------------------------

test('el envío de gestor es una RPC que recibe el agente como actor autenticado', async () => {
  const source = await ops();

  assert.match(source, /createAgentTransferOperation/);
  assert.match(source, /p_agent_id/);
  assert.match(source, /p_actor_user_id/);
  assert.match(source, /p_receiver_user_id/);
});

test('el envío de gestor distingue entre liquidación en billetera y recogida en ventana', async () => {
  const source = await ops();

  assert.match(source, /receiverUserId/);
  assert.match(source, /p_receiver_user_id: payload\.receiverUserId \?\? null/);
});