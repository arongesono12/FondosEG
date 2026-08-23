import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function load(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

const MIGRATION = 'supabase/migrations/20260823_client_wallet_self_custody.sql';

function sliceFunction(sql: string, name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}`);
  assert.ok(start > 0, `no se encontró la función ${name}`);
  const end = sql.indexOf('$$ LANGUAGE plpgsql SECURITY DEFINER;', start);
  assert.ok(end > start, `no se encontró el final de ${name}`);
  return sql.slice(start, end);
}

test('emitir un código retiene el importe contra el saldo disponible, no el bruto', async () => {
  const create = sliceFunction(await load(MIGRATION), 'create_client_withdrawal_operation');

  assert.match(create, /FOR UPDATE/);
  assert.match(
    create,
    /v_available := COALESCE\(v_balance\.balance, 0\) - COALESCE\(v_balance\.reserved_balance, 0\)/
  );
  assert.match(create, /IF v_available < p_amount THEN\s+RAISE EXCEPTION 'Insufficient balance'/);
  assert.match(create, /SET reserved_balance = v_reserved/);
  assert.match(create, /client_withdrawal_reserved/);
});

test('el pago del retiro mueve las dos puntas en una sola transacción', async () => {
  const payout = sliceFunction(await load(MIGRATION), 'pay_out_client_withdrawal_operation');

  // Ambos saldos bloqueados antes de escribir nada.
  assert.match(payout, /FROM public\.client_balances[\s\S]*?FOR UPDATE/);
  assert.match(payout, /FROM public\.agent_balances[\s\S]*?FOR UPDATE/);

  // El gestor cambia efectivo por float; el cliente pierde saldo y retención.
  assert.match(payout, /v_new_agent_balance := v_prev_agent_balance \+ v_withdrawal\.amount/);
  assert.match(payout, /v_new_agent_cash := v_prev_agent_cash - v_withdrawal\.amount/);
  assert.match(payout, /IF v_prev_agent_cash < v_withdrawal\.amount THEN/);
  assert.match(payout, /v_client_new_balance := COALESCE\(v_client_balance\.balance, 0\) - v_withdrawal\.amount/);
  assert.match(payout, /reserved_balance = v_client_new_reserved/);
});

test('un código caducado libera la retención en lugar de bloquear el dinero para siempre', async () => {
  const sql = await load(MIGRATION);
  const payout = sliceFunction(sql, 'pay_out_client_withdrawal_operation');
  const sweeper = sliceFunction(sql, 'release_expired_client_withdrawals');
  const service = await load('services/withdrawal.ts');

  assert.match(payout, /expires_at < v_now/);
  assert.match(payout, /RAISE EXCEPTION 'Withdrawal has expired'/);
  // La liberación NO puede ir aquí: `RAISE EXCEPTION` deshace la transacción y
  // esa escritura se perdería, aparentando una liberación que nunca ocurrió.
  const expiryBranch = payout.slice(
    payout.indexOf('IF v_withdrawal.expires_at IS NOT NULL'),
    payout.indexOf("RAISE EXCEPTION 'Withdrawal has expired'")
  );
  assert.doesNotMatch(expiryBranch, /UPDATE public\./);

  // Quien libera de verdad es el barrido, que no lanza y confirma su trabajo.
  assert.match(sweeper, /WHERE status = 'pending'/);
  assert.match(sweeper, /SET status = 'expired'/);
  assert.match(sweeper, /client_withdrawal_expired/);
  assert.doesNotMatch(sweeper, /RAISE EXCEPTION/);
  assert.match(service, /withdrawal has expired/i);
});

test('el código de retiro se genera con un CSPRNG', async () => {
  const service = await load('services/withdrawal.ts');

  assert.match(service, /from 'node:crypto'/);
  assert.match(service, /randomInt\(0, 1_000_000\)/);
  assert.doesNotMatch(service, /Math\.random\(\)/);
});

test('sólo el titular puede anular su retiro y sólo un gestor puede pagarlo', async () => {
  const [service, routes, payoutRoute] = await Promise.all([
    load('services/withdrawal.ts'),
    load('app/api/withdrawals/route.ts'),
    load('app/api/withdrawals/payout/route.ts'),
  ]);

  assert.match(service, /if \(withdrawal\.client_id !== actorUserId\)/);
  assert.match(routes, /requireRole\(profile, 'cliente'\)/);
  assert.match(payoutRoute, /requireRole\(profile, 'gestor'\)/);
  // El actor sale de la sesión, nunca del cuerpo de la petición.
  assert.match(payoutRoute, /payOutClientWithdrawal\(resolvedId, profile\.id\)/);
});

test('el listado sanea las retenciones caducadas antes de devolver saldo', async () => {
  const service = await load('services/withdrawal.ts');

  const listing = service.slice(service.indexOf('export async function getClientWithdrawals'));
  assert.match(listing.slice(0, 600), /releaseExpiredClientWithdrawals\(clientId\)/);

  const creation = service.slice(
    service.indexOf('export async function createClientWithdrawal'),
    service.indexOf('export async function getClientWithdrawals')
  );
  assert.match(creation, /releaseExpiredClientWithdrawals\(clientId\)/);
});

test('el gestor resuelve tanto códigos de envío como de retiro desde el mismo mostrador', async () => {
  const modal = await load('components/agent-payout-modal.tsx');

  assert.match(modal, /\/api\/withdrawals\/lookup\?code=/);
  assert.match(modal, /\/api\/transfers\/lookup\?code=/);
  assert.match(modal, /\/api\/withdrawals\/payout/);
  assert.match(modal, /\/api\/transfers\/payout/);
  // El DIP se comprueba contra el titular antes de entregar efectivo.
  assert.match(modal, /document_number/);
});
