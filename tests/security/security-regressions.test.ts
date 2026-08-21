import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('authorization never falls back to unverified getSession state', async () => {
  const source = await readFile(new URL('lib/server/authz.ts', root), 'utf8');
  assert.doesNotMatch(source, /\.auth\.getSession\s*\(/);
});

test('security migration uses atomic upserts and restricted execution', async () => {
  const sql = await readFile(
    new URL('supabase/migrations/20260717_security_concurrency_hardening.sql', root),
    'utf8'
  );
  assert.match(sql, /ON CONFLICT \(api_key_id, window_started_at\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
  assert.match(sql, /SET search_path = public, pg_temp/);
});

test('tracked-secret extensions remain ignored', async () => {
  const ignore = await readFile(new URL('.gitignore', root), 'utf8');
  for (const pattern of ['*.key', '*.der', '*.csr', 'verification-code-*.md']) {
    assert.match(ignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('self-service signup can never self-assign a privileged role', async () => {
  const source = await readFile(new URL('lib/server/clerk-identity.ts', root), 'utf8');

  // El alta guiada sólo admite los dos roles no privilegiados. Si alguna vez
  // este tipo se ensancha a `UserRole`, un usuario podría enviar
  // role: 'superadmin' en el cuerpo de la server action.
  assert.match(
    source,
    /role: Extract<UserRole, 'cliente' \| 'gestor'>/,
    'OnboardingInput.role debe seguir restringido a cliente|gestor'
  );

  // Y un gestor —que mueve dinero de terceros— nunca se auto-activa.
  assert.match(
    source,
    /role === 'gestor' \? 'pending' : 'active'/,
    'el rol gestor debe quedar pendiente de aprobación'
  );

  // La promoción sólo se lee de `publicMetadata`, que el cliente no puede
  // escribir.
  assert.match(source, /clerkUser\.publicMetadata/);
  // `unsafeMetadata` sí es editable desde el navegador: leerlo para decidir el
  // rol sería una escalada de privilegios. Sólo se permite nombrarlo en
  // comentarios, nunca acceder a la propiedad.
  assert.doesNotMatch(source, /\.unsafeMetadata\b/);
});

test('onboarding validates the declared role server-side', async () => {
  const action = await readFile(new URL('app/actions/onboarding.ts', root), 'utf8');
  // La server action es invocable directamente: la validación de cliente no
  // basta. Debe rechazar cualquier rol que no sea cliente o gestor.
  assert.match(
    action,
    /input\.role !== 'cliente' && input\.role !== 'gestor'/,
    'la acción debe validar el rol en servidor'
  );
  // Y debe partir de la identidad de Clerk, nunca de un id que llegue del
  // cliente: aceptar un userId del cuerpo permitiría dar de alta a otro.
  assert.match(action, /getClerkIdentity\(\)/);
});

test('authorization is resource-based, not path-matched in middleware', async () => {
  const proxy = await readFile(new URL('proxy.ts', root), 'utf8');
  // El middleware sólo integra Clerk y refresca la sesión. Proteger por
  // coincidencia de rutas puede divergir del enrutado real de Next y dejar
  // recursos alcanzables, así que la autorización vive en cada recurso.
  assert.match(proxy, /clerkMiddleware\(\)/);
  // Sólo se prohíbe usarlo; nombrarlo en el comentario que explica por qué
  // no se usa es correcto.
  assert.doesNotMatch(proxy, /createRouteMatcher\s*\(/);

  // Las páginas privadas resuelven la sesión en su layout antes de renderizar.
  const dashboardLayout = await readFile(new URL('app/(dashboard)/layout.tsx', root), 'utf8');
  assert.match(dashboardLayout, /getOptionalAuthState\(\)/);
  assert.match(dashboardLayout, /redirect\('\/login'\)/);
});

test('profile mutations take the user id from the session, never the form', async () => {
  const source = await readFile(new URL('app/actions/profile.ts', root), 'utf8');
  // Aceptar un `userId` del formulario permitía editar el perfil de otra
  // persona con sólo cambiar un campo oculto.
  assert.doesNotMatch(source, /formData\.get\('userId'\)/);
  assert.match(source, /await requireProfile\(\)|await requireAuthUser\(\)/);
});

test('dashboard and developer portal use independent product grants', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260718_separate_product_access.sql', root), 'utf8');
  const apiKeys = await readFile(new URL('app/api/api-keys/route.ts', root), 'utf8');
  assert.match(migration, /UNIQUE \(user_id, product\)/);
  assert.match(migration, /WHERE role IN \('admin', 'superadmin'\)/);
  assert.match(apiKeys, /requireDeveloperAccess\(\)/);
  assert.match(apiKeys, /isApplicationAdmin \? requestedEnvironment : 'test'/);
});

test('CSP permits Next development tooling without weakening production', async () => {
  const source = await readFile(new URL('next.config.ts', root), 'utf8');
  assert.match(source, /isDevelopment \? " 'unsafe-eval'" : ""/);
  assert.match(source, /process\.env\.NODE_ENV !== "production"/);
});

test('landing content is visible before client hydration', async () => {
  const source = await readFile(new URL('components/marketing/motion-elements.tsx', root), 'utf8');
  assert.doesNotMatch(source, /initial="hidden"/);
  assert.match(source, /initial=\{false\}/);
});
