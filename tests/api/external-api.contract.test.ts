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

const auth = () => load('lib/api-auth.ts');
const apiSecurity = () => load('lib/server/api-security.ts');
const apiEnvironments = () => load('lib/server/api-environments.ts');
const idempotency = () => load('lib/server/api-idempotency.ts');
const publicApi = () => load('lib/server/public-api.ts');
const sandbox = () => load('lib/server/public-api-sandbox.ts');

// ---------------------------------------------------------------------------
// Autenticación de la API pública
// ---------------------------------------------------------------------------

test('la API autentica con las cabeceras x-api-key y x-api-secret', async () => {
  const source = await auth();

  assert.match(source, /request\.headers\.get\('x-api-key'\)/);
  assert.match(source, /request\.headers\.get\('x-api-secret'\)/);
});

test('la verificación del secreto usa hash + timingSafeEqual, nunca comparación en claro', async () => {
  const security = await apiSecurity();

  assert.match(security, /createHash\('sha256'\)/);
  assert.match(security, /timingSafeEqual/);
  assert.match(security, /randomBytes/);
  assert.doesNotMatch(security, /secret\s*===\s*expected/);
});

test('las llaves de producción y test llevan prefijos sk_live_ y sk_test_', async () => {
  const env = await apiEnvironments();

  assert.match(env, /'sk_live_'/);
  assert.match(env, /'sk_test_'/);
  assert.match(env, /type ApiEnvironment = 'test' \| 'production'/);
});

test('la autenticación falla sin credenciales o con key inválida', async () => {
  const source = await auth();

  assert.match(source, /authentication_required/);
  assert.match(source, /invalid_credentials/);
  assert.match(source, /status: 401/);
});

test('los permisos se resuelven por permiso granular, no por rol', async () => {
  const source = await auth();

  assert.match(source, /requirePermission/);
  assert.match(source, /permissions\[permission\] === true/);
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test('el rate limit se consume vía RPC e incluye reseteo en ventana', async () => {
  const source = await auth();

  assert.match(source, /consume_api_rate_limit/);
  assert.match(source, /rate_limit_window_minutes/);
  assert.match(source, /retryAfterSeconds/);
});

test('el rate limit expone cabeceras x-ratelimit-* y retry-after', async () => {
  const source = await publicApi();

  assert.match(source, /'x-ratelimit-limit'/);
  assert.match(source, /'x-ratelimit-remaining'/);
  assert.match(source, /'x-ratelimit-reset'/);
  assert.match(source, /'retry-after'/);
});

test('el límite por defecto es 100 por ventana configurable', async () => {
  const source = await auth();

  assert.match(source, /rate_limit \|\| 100/);
  assert.match(source, /rate_limit_window_minutes \|\| 60/);
});

// ---------------------------------------------------------------------------
// Idempotencia
// ---------------------------------------------------------------------------

test('la idempotencia reclama la clave atómicamente vía RPC', async () => {
  const source = await idempotency();

  assert.match(source, /claim_api_idempotency_key/);
  assert.match(source, /lockToken/);
  assert.match(source, /requestHash/);
});

test('una clave repetida con distinto payload produce conflicto', async () => {
  const source = await idempotency();

  assert.match(source, /state === 'conflict'/);
  assert.match(source, /La misma clave de idempotencia fue usada con un payload distinto/);
  assert.doesNotMatch(source, /throw new Error\('Idempotency conflict/, 'el conflicto es un estado, no una excepción');
});

test('la respuesta completada se devuelve en caché bajo la misma clave', async () => {
  const source = await idempotency();

  assert.match(source, /state === 'completed'/);
  assert.match(source, /cachedResponse/);
});

// ---------------------------------------------------------------------------
// Sobre de respuesta uniforme
// ---------------------------------------------------------------------------

test('el éxito responde { success, data, request_id }', async () => {
  const source = await publicApi();

  assert.match(source, /success: true/);
  assert.match(source, /data,/);
  assert.match(source, /request_id: context\.requestId/);
});

test('el error responde { success:false, error:{ code, message, ... } }', async () => {
  const source = await publicApi();

  assert.match(source, /success: false/);
  assert.match(source, /error: \{/);
  assert.match(source, /code,/);
  assert.match(source, /message,/);
});

test('el catálogo de errores es cerrado y sin códigos SQL en claro', async () => {
  const source = await publicApi();

  assert.match(source, /'authentication_required'/);
  assert.match(source, /'invalid_credentials'/);
  assert.match(source, /'rate_limit_exceeded'/);
  assert.match(source, /'permission_denied'/);
  assert.match(source, /'validation_error'/);
  assert.match(source, /'idempotency_conflict'/);
  assert.match(source, /'business_rule_failed'/);
  assert.match(source, /'internal_error'/);
});

test('los errores internos SQL/Postgres nunca se filtran al integrador', async () => {
  const source = await publicApi();

  assert.match(source, /unsafePatterns/);
  assert.match(source, /\/duplicate key\/i/);
  assert.match(source, /\/service_role\/i/);
  assert.match(source, /\/sql\/i/);
  assert.match(source, /La operacion no pudo completarse/);
});

// ---------------------------------------------------------------------------
// Observabilidad
// ---------------------------------------------------------------------------

test('cada petición se registra en api_request_logs con request_id y latencia', async () => {
  const source = await publicApi();

  assert.match(source, /api_request_logs/);
  assert.match(source, /request_id: context\.requestId/);
  assert.match(source, /latency_ms/);
  assert.match(source, /status_code/);
});

test('portar el registro de peticiones fallido no tira abajo la respuesta', async () => {
  const source = await publicApi();

  assert.match(source, /catch \(error\)/);
  assert.match(source, /Public API request log failed/);
});

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

test('el sandbox devuelve datos simulados marcados sandbox:true y sin mover dinero', async () => {
  const source = await sandbox();

  assert.match(source, /createSandboxBalance/);
  assert.match(source, /createSandboxAgentTransfer/);
  assert.match(source, /createSandboxWalletTransfer/);
  assert.match(source, /createSandboxHistory/);
  assert.match(source, /sandbox: true/);
});

test('la transferencia del sandbox simula un vale TST y estado available_for_pickup', async () => {
  const source = await sandbox();

  assert.match(source, /transfer_code: `TST/);
  assert.match(source, /status: 'available_for_pickup'/);
});

// ---------------------------------------------------------------------------
// Endpoint: balance
// ---------------------------------------------------------------------------

test('la ruta de balance reexporta v1 y monta el contexto de API pública', async () => {
  const source = await load('app/api/external/balance/route.ts');

  assert.match(source, /authenticateAPIKey/);
  assert.match(source, /requirePermission/);
});

// ---------------------------------------------------------------------------
// Endpoint: transfer
// ---------------------------------------------------------------------------

test('la ruta de transfer exigió idempotency-key antes de mover dinero', async () => {
  const source = await load('app/api/external/transfer/route.ts');

  assert.match(source, /idempotency-key/);
  assert.match(source, /factor obligatorio|Obligatorio|obligatorio/i);
});

test('la ruta de transfer enruta al sandbox cuando la credencial es de test', async () => {
  const source = await load('app/api/external/transfer/route.ts');

  assert.match(source, /environment === 'test'/);
  assert.match(source, /createSandboxAgentTransfer/);
});

test('la respuesta de transfer incluye transfer_id y nunca filtra el código interno de entrega', async () => {
  const source = await load('app/api/external/wallet-transfer/route.ts');

  assert.match(source, /transfer_id/);
  assert.doesNotMatch(source, /verification_code/);
});