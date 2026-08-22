import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

/**
 * Elimina comentarios antes de inspeccionar el código. Estas pruebas afirman
 * sobre todo la AUSENCIA de patrones, y la prosa que explica por qué un patrón
 * está prohibido suele citarlo textualmente: sin este filtro, el comentario que
 * documenta la corrección haría fallar a la prueba que la protege.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

async function load(path: string): Promise<string> {
  return stripComments(await readFile(new URL(path, root), 'utf8'));
}

const service = () => load('services/wallet-transfer.ts');
const route = () => load('app/api/wallet-transfer/route.ts');
const sendModal = () => load('components/wallet-transfer-modal.tsx');
const verifyModal = () => load('components/verify-transfer-modal.tsx');
const notifications = () => load('lib/server/notification-outbox.ts');
const types = () => load('types/index.ts');

test('el saldo del emisor no se lee como embed de `users`', async () => {
  const source = await service();

  // `client_balances.client_id` es UNIQUE, así que PostgREST resuelve la
  // relación como uno-a-uno y devuelve un OBJETO. Embeberla y llamar a `.find()`
  // lanzaba `TypeError: sender.client_balances?.find is not a function`, que la
  // ruta convertía en un 500 "Internal server error": el flujo no llegó a crear
  // ni una sola transferencia.
  assert.doesNotMatch(
    source,
    /client_balances\(\*\)/,
    'el saldo debe consultarse en su propia tabla, no embebido en users'
  );
  assert.doesNotMatch(
    source,
    /client_balances\?\.find/,
    'client_balances no es un array: no admite .find()'
  );
});

test('no se filtra el saldo por divisa contra una tabla de una fila por cliente', async () => {
  const source = await service();

  // Con `client_id` UNIQUE hay como mucho una fila por cliente. Filtrar además
  // por `currency` devolvía 0 filas para cualquier usuario cuya preferencia de
  // visualización no fuese XAF: saldo 0, "Saldo insuficiente" con fondos, y un
  // INSERT que violaba el UNIQUE al confirmar.
  assert.doesNotMatch(
    source,
    /from\('client_balances'\)[\s\S]{0,200}?\.eq\('currency'/,
    'la consulta de client_balances no debe filtrar por divisa'
  );
});

test('las consultas de transferencias no dependen de claves foráneas inexistentes', async () => {
  const source = await service();

  // La tabla desplegada no declara `wallet_transfers_sender_id_fkey` ni su
  // pareja, así que el embed respondía PGRST200 y dejaba la confirmación en
  // "Transfer not found" y la lista de pendientes siempre vacía.
  assert.doesNotMatch(
    source,
    /users!wallet_transfers_/,
    'las partes deben resolverse con una consulta explícita, no con embeds por FK'
  );
  assert.match(source, /async function attachParties/);
});

test('el código de verificación se genera con un CSPRNG', async () => {
  const source = await service();

  // El estado de `Math.random()` es reconstruible observando salidas sucesivas:
  // permitía predecir el código de una orden ajena a partir de códigos propios.
  assert.doesNotMatch(source, /Math\.random\(\)/);
  assert.match(source, /from 'node:crypto'/);
  assert.match(source, /randomInt\(/);
});

test('sólo el beneficiario puede confirmar una transferencia', async () => {
  const source = await service();
  const api = await route();

  // `confirmWalletTransfer` recibía sólo {transfer_id, verification_code}: con el
  // código en la mano, cualquier usuario autenticado podía liquidar la orden de
  // pago de otro.
  assert.match(
    source,
    /export async function confirmWalletTransfer\(\s*data: ConfirmWalletTransferData,\s*actorUserId: string/,
    'confirmWalletTransfer debe recibir el actor autenticado'
  );
  assert.match(
    source,
    /transfer\.receiver_id !== actorUserId/,
    'debe rechazarse a quien no sea el beneficiario'
  );
  assert.match(
    api,
    /confirmWalletTransfer\(data, user\.id\)/,
    'la ruta debe propagar el actor, nunca leerlo del cuerpo'
  );
});

test('la confirmación reclama la transferencia antes de mover dinero', async () => {
  const source = await service();

  // Sin el filtro por `status = 'pending'` en el UPDATE, dos peticiones
  // concurrentes (un doble clic basta) confirmaban la misma orden dos veces y
  // acreditaban el importe dos veces.
  assert.match(
    source,
    /\.update\(\{ status: 'confirmed'[\s\S]{0,200}?\.eq\('status', 'pending'\)/,
    'la transición pending -> confirmed debe ser condicional'
  );
});

test('todas las escrituras de saldo comprueban su resultado', async () => {
  const source = await service();

  // Las tres escrituras descartaban `{ error }`: si fallaba el abono tras el
  // débito, el dinero desaparecía y la orden se marcaba `confirmed` igualmente.
  assert.match(source, /if \(debitError \|\| !debited\)/);
  assert.match(source, /if \(creditFailed\)/);
  assert.match(source, /releaseClaim/, 'un fallo a mitad debe compensarse');
});

test('el destinatario se busca con el teléfono normalizado', async () => {
  const source = await service();

  // Los teléfonos conviven en varios formatos ("+240 XXXXXXXXX" desde
  // PhoneInput, "+240XXXXXXXXX" desde otras altas). La igualdad exacta dejaba
  // fuera a destinatarios que sí existían.
  assert.match(source, /getPhoneLookupCandidates/);
  assert.match(source, /normalizePhoneDigits/);
  assert.doesNotMatch(
    source,
    /\.eq\('phone', data\.receiver_phone\)/,
    'la búsqueda por igualdad exacta de teléfono es la que rompía el envío'
  );
});

test('el emisor sin teléfono recibe un mensaje accionable', async () => {
  const source = await service();

  // `users.phone` admite NULL desde la migración a Clerk, pero
  // `wallet_transfers.sender_phone` sigue siendo NOT NULL.
  assert.match(source, /if \(!sender\.phone\?\.trim\(\)\)/);
});

test('un consentimiento no registrable no deja órdenes cobrables vivas', async () => {
  const source = await service();

  // `recordPaymentConsent` se ejecuta después del INSERT. Si lanzaba, el emisor
  // veía un 500 y creía que no había pasado nada, pero quedaba una transferencia
  // `pending` que el beneficiario podía cobrar durante 24 horas.
  assert.match(source, /catch \(consentError\)/);
  assert.match(
    source,
    /catch \(consentError\)[\s\S]{0,400}?update\(\{ status: 'cancelled' \}\)/,
    'la orden debe anularse si no se puede dejar evidencia del consentimiento'
  );
});

test('los errores internos no se filtran al navegador', async () => {
  const source = await service();

  // `transferError.message` iba tal cual a la caja de error del modal.
  assert.doesNotMatch(source, /error: transferError\.message/);
  assert.doesNotMatch(source, /error: confirmError\.message/);
  assert.doesNotMatch(source, /error: cancelError\.message/);
});

test('la lista de pendientes tolera una respuesta de error', async () => {
  const source = await verifyModal();

  // El GET devuelve un array en el camino feliz y `{ error }` en 401/403/500.
  // Asignar el objeto al estado rompía el render con
  // "pendingTransfers.map is not a function".
  assert.match(source, /Array\.isArray\(data\)/);
});

test('la auto-verificación exige transferencia y no puede entrar en bucle', async () => {
  const source = await verifyModal();

  // La guarda original era `!transfer`, justo lo contrario de lo que necesita
  // `handleVerify`. Al corregirla hace falta `lastAttemptedCode`: si no, un
  // código incorrecto relanzaría el efecto contra el servidor sin parar.
  assert.doesNotMatch(source, /verificationCode\.length === 6 && !transfer/);
  assert.match(source, /lastAttemptedCode\.current !== verificationCode/);
});

test('la cancelación no se da por buena sin mirar la respuesta', async () => {
  const source = await sendModal();

  // Se cerraba el diálogo pase lo que pase: el usuario creía haber anulado una
  // orden que seguía viva y cobrable durante 24 horas.
  assert.match(source, /if \(!res\.ok \|\| !data\.success\)/);
});

test('el modal de envío usa la divisa real de la billetera', async () => {
  const source = await sendModal();

  // `preferredCurrency` es una preferencia de visualización y no hay conversión
  // en ninguna capa: usarla como divisa de la operación mostraba saldo 0 y
  // bloqueaba el envío antes siquiera de llamar al API.
  assert.doesNotMatch(source, /const currency = preferredCurrency/);
  assert.match(source, /setCurrency\(wallet\?\.currency \|\| 'XAF'\)/);
});

test('el marcador de teléfono usa el prefijo de Guinea Ecuatorial', async () => {
  const source = await sendModal();

  // El placeholder sugería "+237 6XX XXX XXX" (Camerún) mientras los clientes
  // están dados de alta con +240: inducía activamente al formato que no
  // encontraba a nadie.
  assert.doesNotMatch(source, /\+237/);
  assert.match(source, /placeholder="\+240/);
});

// ---------------------------------------------------------------------------
// Modelo de seguridad: el código es un vale al portador que custodia el emisor.
//
// Sólo se sostiene si el beneficiario no puede obtener el código por ningún
// canal propio: ni por aviso, ni leyéndolo de una respuesta del API. Si alguna
// de estas pruebas falla, el paso de "entrega en mano" deja de controlar nada y
// el beneficiario puede cobrar cuando quiera.
// ---------------------------------------------------------------------------

test('el aviso al beneficiario no puede transportar el código', async () => {
  const source = await notifications();

  // El aviso decía "su código es N. No comparta este código con nadie", lo que
  // contradecía frontalmente a la pantalla del emisor, que pedía compartirlo.
  assert.doesNotMatch(source, /input\.code/, 'el aviso no debe interpolar el código');
  assert.doesNotMatch(source, /No comparta este código/);
  assert.match(source, /export async function queueWalletPendingNotice/);
});

test('la consulta de pendientes ni siquiera selecciona el código', async () => {
  const source = await service();

  const select = source.match(/getPendingWalletTransfers[\s\S]*?\.select\(([\s\S]*?)\)/)?.[1];
  assert.ok(select, 'no se ha localizado la consulta de transferencias pendientes');

  // Es una consulta dirigida al beneficiario: el código no debe salir de la
  // base de datos, no basta con borrarlo después.
  assert.doesNotMatch(select, /verification_code/);
  assert.doesNotMatch(select, /\*/, 'select(*) devolvería el código al beneficiario');
});

test('el historial oculta el código a quien no es el emisor', async () => {
  const source = await service();

  assert.match(source, /function redactCodeForNonSender/);
  assert.match(
    source,
    /return redactCodeForNonSender\(transfers, clientId\)/,
    'el historial debe redactar antes de responder'
  );
});

test('el buscador no es un oráculo del código para el beneficiario', async () => {
  const source = await load('app/api/transfers/search/route.ts');

  // El código no se devuelve en la respuesta, pero se podía filtrar por él. Con
  // un mínimo de 3 caracteres, el beneficiario podía probar fragmentos y ver si
  // su transferencia aparecía, reconstruyendo el vale sin recibirlo.
  assert.match(
    source,
    /t\.sender_id === profile\.id && String\(t\.verification_code/,
    'la búsqueda por código debe estar reservada al emisor'
  );
});

test('el tipo declara que el código puede no venir', async () => {
  const source = await types();

  // Si fuese obligatorio, el compilador dejaría asumir que está presente en las
  // respuestas dirigidas al beneficiario, que es justo donde se omite.
  assert.match(source, /verification_code\?: string;/);
});
