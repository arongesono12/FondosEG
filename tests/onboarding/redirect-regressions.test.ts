import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);

test('completing onboarding invalidates the cached layout tree', async () => {
  const action = await readFile(new URL('app/actions/onboarding.ts', root), 'utf8');

  // Sin revalidar, `router.push('/dashboard')` sirve la carga RSC generada
  // ANTES del alta —con el `redirect('/onboarding')` del layout dentro— y el
  // usuario rebota al formulario que acaba de completar.
  assert.match(
    action,
    /revalidatePath\('\/', 'layout'\)/,
    'la acción debe invalidar el árbol de layouts tras crear el perfil'
  );
});

test('the client refreshes before navigating, not after', async () => {
  const flow = await readFile(new URL('components/auth/onboarding-flow.tsx', root), 'utf8');

  const refreshAt = flow.indexOf('router.refresh()');
  const pushAt = flow.indexOf("router.push('/dashboard')");

  assert.ok(refreshAt !== -1, 'debe refrescar el router');
  assert.ok(pushAt !== -1, 'debe navegar al dashboard');
  assert.ok(
    refreshAt < pushAt,
    'refresh() debe ir ANTES de push(): al revés, la navegación usa la caché obsoleta'
  );
});

test('a half-provisioned profile is repaired instead of locking the user out', async () => {
  const layout = await readFile(new URL('app/(dashboard)/layout.tsx', root), 'utf8');

  // Si el alta creó la fila de `users` pero falló al crear `account_access`,
  // el usuario queda encerrado: /onboarding lo manda al dashboard por tener
  // perfil, y el dashboard a /forbidden por no tener acceso.
  assert.match(
    layout,
    /ensureProductAccessAndBalances\(/,
    'el layout debe reaprovisionar un perfil sin account_access'
  );
});

test('completing onboarding activates the account whatever the role', async () => {
  const identity = await readFile(new URL('lib/server/clerk-identity.ts', root), 'utf8');

  // El alta no debe dejar a nadie esperando: ni cliente ni gestor.
  assert.doesNotMatch(
    identity,
    /status: 'pending'/,
    'el aprovisionamiento no debe crear accesos en espera'
  );
  assert.match(
    identity,
    /status: 'active'/,
    'el acceso al dashboard debe crearse activo'
  );

  // Y el gestor recibe su saldo de caja de inmediato: sin esa fila, su panel
  // no puede operar.
  assert.match(
    identity,
    /agent_balances/,
    'un gestor debe recibir su fila de agent_balances al darse de alta'
  );

  const flow = await readFile(new URL('components/auth/onboarding-flow.tsx', root), 'utf8');
  assert.doesNotMatch(
    flow,
    /aprueben tu solicitud|Requiere aprobación/,
    'el formulario no debe prometer una aprobación que ya no existe'
  );
});
