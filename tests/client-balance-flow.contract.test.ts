import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function load(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

test('el panel y la API externa vinculan el mismo cliente antes de crear un envío', async () => {
  const [dashboardRoute, externalRoute, recipientResolver] = await Promise.all([
    load('app/api/transfers/route.ts'),
    load('app/api/external/transfer/route.ts'),
    load('lib/server/client-recipient.ts'),
  ]);

  for (const source of [dashboardRoute, externalRoute]) {
    assert.match(source, /findRegisteredClientByPhone/);
    assert.match(source, /receiverUserId:\s*registeredReceiver\?\.id \?\? null/);
  }

  assert.match(recipientResolver, /\.eq\('role', 'cliente'\)/);
  assert.match(recipientResolver, /normalizePhoneDigits/);
  assert.doesNotMatch(recipientResolver, /return data!\[0\]/);

  // Vincular ahora LIQUIDA el envío en la billetera: una cuenta desactivada no
  // puede entrar al panel, así que el dinero quedaría encerrado. Esos casos
  // vuelven al flujo de ventanilla, donde siguen siendo cobrables en mano.
  assert.match(recipientResolver, /is_active/);
  assert.match(recipientResolver, /user\.is_active !== false/);
});

test('el envío a un cliente registrado se liquida en su billetera, no queda pendiente de retiro', async () => {
  const migration = await load('supabase/migrations/20260823_client_wallet_self_custody.sql');

  assert.match(migration, /receiver_user_id/);
  assert.match(migration, /v_wallet_settled BOOLEAN := p_receiver_user_id IS NOT NULL/);
  // El estado depende de si hay cuenta vinculada: liquidado o de ventanilla.
  assert.match(
    migration,
    /CASE WHEN v_wallet_settled THEN 'completed' ELSE 'available_for_pickup' END/
  );
  assert.match(migration, /SET balance = v_receiver_new_balance/);
  assert.match(migration, /agent_transfer_wallet_credit/);
});

test('el pago en ventanilla ya no puede debitar la billetera de un cliente registrado', async () => {
  const migration = await load('supabase/migrations/20260823_client_wallet_self_custody.sql');

  const payoutStart = migration.indexOf('FUNCTION public.pay_out_agent_transfer_operation');
  const payoutEnd = migration.indexOf('FUNCTION public.correct_agent_transfer_operation');
  assert.ok(payoutStart > 0 && payoutEnd > payoutStart);
  const payout = migration.slice(payoutStart, payoutEnd);

  // Se rechaza antes de tocar ningún saldo.
  assert.match(payout, /IF v_transfer\.receiver_user_id IS NOT NULL THEN\s+RAISE EXCEPTION 'Transfer settled to wallet'/);
  // Y no queda ninguna escritura sobre el saldo del cliente en esta función.
  assert.doesNotMatch(payout, /UPDATE public\.client_balances/);
  assert.doesNotMatch(payout, /wallet_debited_at = /);
});

test('las rutas de ventanilla rechazan los envíos ya liquidados en billetera', async () => {
  const [lookup, payout] = await Promise.all([
    load('app/api/transfers/lookup/route.ts'),
    load('app/api/transfers/payout/route.ts'),
  ]);

  for (const source of [lookup, payout]) {
    assert.match(source, /receiver_user_id/);
    assert.match(source, /su propio código de retiro/);
  }
});

test('los envíos ya acreditados dejan de estar disponibles para retiro en ventanilla', async () => {
  const migration = await load('supabase/migrations/20260823_client_wallet_self_custody.sql');

  // La normalización no mueve dinero: sólo cierra el estado de lo que ya estaba
  // en la billetera del cliente.
  assert.match(migration, /UPDATE public\.transfers\s+SET\s+status = 'completed'/);
  assert.match(migration, /AND wallet_debited_at IS NULL\s+AND status IN \('created', 'available_for_pickup'\)/);
});

test('el dashboard del cliente incluye los envíos de gestor recibidos en actividad y métricas', async () => {
  const [recentTransfers, stats] = await Promise.all([
    load('app/api/dashboard/recent-transfers/route.ts'),
    load('app/api/dashboard/stats/route.ts'),
  ]);

  assert.match(recentTransfers, /sender_id\.eq\.\$\{profile\.id\},receiver_user_id\.eq\.\$\{profile\.id\}/);
  assert.match(stats, /\.eq\('receiver_user_id', profile\.id\)/);
  assert.match(stats, /normalizedReceivedAgentTransfers/);
  assert.match(stats, /const clientTransfers = \[\.\.\.normalizedWalletTransfers, \.\.\.normalizedReceivedAgentTransfers\]/);
});

test('el aviso al beneficiario con cuenta no le manda a ventanilla con el código del envío', async () => {
  const messages = await load('lib/transfer-notification-messages.ts');

  assert.match(messages, /if \(input\.settledToWallet\)/);
  assert.match(messages, /generar usted mismo un código de retiro/);

  const settledBranch = messages.slice(
    messages.indexOf('if (input.settledToWallet)'),
    messages.indexOf('const senderMessage = [', messages.indexOf('if (input.settledToWallet)') + 200)
  );
  assert.doesNotMatch(settledBranch, /Código de envío/);
  assert.doesNotMatch(settledBranch, /presente este código/i);
});
