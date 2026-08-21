/**
 * Importa a Clerk los usuarios que ya existían en Supabase.
 *
 * La migración a Clerk trasladó la identidad, pero Clerk arranca con su
 * almacén de usuarios vacío: las cuentas antiguas no podían iniciar sesión
 * porque Clerk no las conocía. Este script las da de alta y las vincula.
 *
 *   node scripts/import-users-to-clerk.mjs              # simulación
 *   node scripts/import-users-to-clerk.mjs --apply      # ejecuta de verdad
 *   node scripts/import-users-to-clerk.mjs --apply --passwords hashes.json
 *
 * Sin `--passwords`, los usuarios se crean SIN contraseña: entran con Google o
 * usando "¿Olvidaste tu contraseña?". Con `--passwords`, conservan la que ya
 * tenían (Supabase y Clerk usan bcrypt, así que el hash se importa tal cual).
 *
 * Para exportar los hashes, ejecuta esto en el editor SQL de Supabase y guarda
 * el resultado como JSON:
 *
 *   SELECT json_object_agg(lower(email), encrypted_password)
 *   FROM auth.users
 *   WHERE encrypted_password IS NOT NULL AND email IS NOT NULL;
 *
 * Es idempotente: relanzarlo no duplica nada. Los usuarios que ya tienen
 * `clerk_user_id` se omiten, y si el correo ya existe en Clerk se vincula en
 * lugar de crearse.
 */

import { readFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const passwordsFlag = process.argv.indexOf('--passwords');
const passwordsFile = passwordsFlag !== -1 ? process.argv[passwordsFlag + 1] : null;

function loadEnv() {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET = env.CLERK_SECRET_KEY;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  CLERK_SECRET_KEY: CLERK_SECRET,
})) {
  if (!value) {
    console.error(`Falta ${name} en .env`);
    process.exit(1);
  }
}

const instance = CLERK_SECRET.startsWith('sk_live_') ? 'PRODUCCIÓN' : 'desarrollo';

const supabaseHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const clerkHeaders = {
  Authorization: `Bearer ${CLERK_SECRET}`,
  'Content-Type': 'application/json',
};

function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${name.slice(0, 2)}***@${domain}`;
}

function splitName(fullName, email) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: email.split('@')[0], last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Comprueba que la instancia acepte usuarios sin teléfono.
 *
 * Clerk no admite números de Guinea Ecuatorial, así que el teléfono no puede
 * viajar en la importación. Si además la instancia lo marca como obligatorio,
 * toda creación falla con `form_data_missing` y no hay forma de salir del paso
 * desde el código: hay que desactivarlo en el panel de Clerk.
 */
async function assertPhoneNotRequired() {
  const publishable = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const encoded = publishable.replace(/^pk_(test|live)_/, '');
  if (encoded === publishable) return true;

  let host;
  try {
    host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$+$/, '').trim();
  } catch {
    return true;
  }
  if (!host) return true;

  let settings;
  try {
    const response = await fetch(
      `https://${host}/v1/environment?__clerk_api_version=2021-02-05&_clerk_js_version=5.0.0`
    );
    if (!response.ok) return true;
    settings = (await response.json())?.user_settings;
  } catch {
    return true; // Una comprobación previa nunca debe impedir el intento.
  }

  if (settings?.attributes?.phone_number?.required) {
    console.error(
      'La instancia exige número de teléfono para crear usuarios, pero Clerk no\n' +
        'admite números de Guinea Ecuatorial (+240), así que la importación no\n' +
        'puede aportar ninguno y fallaría en todas las cuentas.\n\n' +
        'Desactívalo antes de continuar:\n' +
        '  Clerk Dashboard -> Configure -> User & authentication\n' +
        '    -> Email, phone, username -> Phone number -> quitar "Required"\n\n' +
        'El teléfono se seguirá pidiendo en el paso 2 del alta y se guarda en\n' +
        'public.users, que es donde la aplicación lo usa.'
    );
    // `process.exit()` con peticiones de red aún abiertas hace que libuv aborte
    // ruidosamente en Windows. Marcar el código y volver deja salir a Node solo.
    return false;
  }

  return true;
}

async function fetchPendingUsers() {
  // Se traen TODAS las cuentas con correo, no sólo las que no tienen
  // `clerk_user_id`. Ese filtro era incorrecto: el id guardado pertenece a UNA
  // instancia de Clerk concreta, y al importar a otra (desarrollo -> producción)
  // hay que recrear y revincular aunque ya hubiera un id. Quién sobra lo decide
  // la comparación contra la instancia actual, no la existencia del campo.
  //
  // `id.asc` desempata el orden: `created_at` puede venir nulo o repetido en
  // filas heredadas, y sin orden estable el recorrido cambia entre ejecuciones.
  const url =
    `${SUPABASE_URL}/rest/v1/users` +
    `?select=id,email,name,phone,role,clerk_user_id` +
    `&email=not.is.null` +
    `&order=created_at.asc,id.asc`;
  const response = await fetch(url, { headers: supabaseHeaders });
  if (!response.ok) {
    throw new Error(`Supabase respondió ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function findClerkUserByEmail(email) {
  const url = `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`;
  const response = await fetch(url, { headers: clerkHeaders });
  if (!response.ok) return null;
  const users = await response.json();
  return Array.isArray(users) && users.length > 0 ? users[0] : null;
}

async function createClerkUser(payload) {
  const response = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: clerkHeaders,
    body: JSON.stringify(payload),
  });

  if (response.ok) return { user: await response.json() };
  return { error: await response.text(), status: response.status };
}

async function linkClerkId(internalId, clerkUserId) {
  const url = `${SUPABASE_URL}/rest/v1/users?id=eq.${internalId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...supabaseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ clerk_user_id: clerkUserId, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) {
    throw new Error(`No se pudo vincular ${internalId}: ${await response.text()}`);
  }
}

async function main() {
  let passwords = null;
  if (passwordsFile) {
    const parsed = JSON.parse(readFileSync(passwordsFile, 'utf8'));
    // Admite tanto {correo: hash} como el objeto que devuelve json_object_agg.
    passwords = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key.toLowerCase().trim(), value])
    );
  }

  if (!(await assertPhoneNotRequired())) {
    process.exitCode = 1;
    return;
  }

  const pending = await fetchPendingUsers();

  console.log(`Instancia de Clerk : ${instance}`);
  console.log(`Modo               : ${APPLY ? 'APLICAR' : 'simulación (usa --apply para ejecutar)'}`);
  console.log(`Contraseñas        : ${passwords ? `${Object.keys(passwords).length} hashes cargados` : 'sin importar (los usuarios deberán restablecerla o entrar con Google)'}`);
  console.log(`Por procesar       : ${pending.length}\n`);

  const summary = { created: 0, linked: 0, skipped: 0, failed: 0 };

  for (const user of pending) {
    const email = String(user.email).toLowerCase().trim();
    const label = `${maskEmail(email)} (${user.role})`;

    const existing = await findClerkUserByEmail(email);
    if (existing) {
      if (user.clerk_user_id === existing.id) {
        console.log(`  = ${label}: ya vinculado a esta instancia, sin cambios`);
        summary.skipped += 1;
        continue;
      }
      const reason = user.clerk_user_id ? 'revinculando desde otra instancia' : 'vinculando';
      console.log(`  ~ ${label}: ya existe en Clerk, ${reason}`);
      if (APPLY) await linkClerkId(user.id, existing.id);
      summary.linked += 1;
      continue;
    }

    const { first, last } = splitName(user.name, email);
    const digest = passwords?.[email] ?? null;

    // El teléfono NO se envía a Clerk. Clerk rechaza los números de Guinea
    // Ecuatorial (+240) con `unsupported_country_code`, así que el teléfono
    // vive únicamente en public.users, que es donde la aplicación lo usa.
    const payload = {
      email_address: [email],
      first_name: first,
      last_name: last || undefined,
      // Conserva el UUID interno visible desde Clerk. No se usa para
      // autorizar: el puente real sigue siendo users.clerk_user_id.
      external_id: user.id,
      skip_password_checks: true,
    };

    if (digest) {
      payload.password_digest = digest;
      payload.password_hasher = 'bcrypt';
    } else {
      payload.skip_password_requirement = true;
    }

    if (!APPLY) {
      console.log(`  + ${label}: se crearía${digest ? ' con su contraseña actual' : ' sin contraseña'}`);
      summary.created += 1;
      continue;
    }

    let result = await createClerkUser(payload);

    // Si la instancia no tiene habilitados los atributos de nombre, Clerk
    // rechaza first_name/last_name. Se reintenta sin ellos.
    if (result.error && /first_name|last_name/.test(result.error)) {
      const { first_name, last_name, ...withoutNames } = payload;
      void first_name;
      void last_name;
      result = await createClerkUser(withoutNames);
    }

    if (result.error) {
      console.error(`  ! ${label}: ${result.status} ${result.error.slice(0, 220)}`);
      summary.failed += 1;
      continue;
    }

    await linkClerkId(user.id, result.user.id);
    console.log(`  + ${label}: creado y vinculado${digest ? ' (contraseña conservada)' : ''}`);
    summary.created += 1;
  }

  console.log(
    `\nResumen: ${summary.created} creados, ${summary.linked} vinculados, ` +
      `${summary.skipped} omitidos, ${summary.failed} fallidos`
  );

  if (!APPLY) console.log('\nNada se ha modificado. Relanza con --apply para aplicar.');
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('\nFallo:', error.message);
  process.exitCode = 1;
});
