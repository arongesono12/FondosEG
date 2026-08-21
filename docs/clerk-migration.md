# Migración de Supabase Auth a Clerk

Estado: código migrado. Falta ejecutar la migración SQL y las claves de Clerk.

## Qué cambia y qué no

| Antes | Ahora |
|---|---|
| Supabase Auth: sesión, contraseña, OTP por correo | **Clerk**: sesión, contraseña, verificación, OAuth, MFA |
| `public.users.id` = `auth.users.id` | `public.users.id` sigue siendo el **mismo UUID interno**; el puente es `clerk_user_id` |
| Perfil creado durante el registro | Perfil creado *just-in-time* en la primera petición autenticada |
| Cada ruta se acordaba de llamar a `requireAuthUser()` | `proxy.ts` protege **todo** salvo una lista explícita de rutas públicas |
| Acceso a datos con anon key + RLS `auth.uid()` | Acceso a datos sólo con service-role; la autorización vive en `lib/server/authz.ts` |

**Ningún dato histórico se pierde.** Transferencias, saldos, comisiones y logs
siguen apuntando al mismo UUID.

## Pasos pendientes

### 1. Claves de Clerk

```bash
clerk auth login
clerk init --app app_3IDjZ6gyBHu6zZxx3QKLUxxOw51
```

`clerk init` escribe `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`.
Si prefieres hacerlo a mano, cópialas del dashboard de Clerk a `.env` junto con
las rutas que ya están documentadas en `.env.example`.

### 2. Migración de base de datos

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260821_clerk_identity_migration.sql
```

Haz copia de seguridad antes: la migración repunta claves foráneas y elimina el
trigger `on_auth_user_created`.

### 3. Migración de las cuentas existentes

Los usuarios actuales viven en `auth.users` con su contraseña *hasheada*. Hay
dos caminos:

**Opción A — Migración en caliente (recomendada, sin fricción para el usuario).**
No hace falta migrar nada por adelantado. Cuando un usuario existente se
registra en Clerk con **el mismo correo**, `resolveInternalUser()` lo reconecta
por email a su fila de `public.users`, conservando UUID, rol, saldos e
histórico. La primera vez tendrá que establecer contraseña en Clerk.

**Opción B — Importar los hashes a Clerk.** Supabase usa bcrypt, que Clerk
acepta. Exporta `id, email, encrypted_password` de `auth.users` y créalos con
`clerk.users.createUser({ passwordDigest, passwordHasher: 'bcrypt' })`. Los
usuarios conservan su contraseña actual. Rellena después `users.clerk_user_id`
con el id devuelto para cada correo.

Mientras `clerk_user_id` esté a NULL, la reconexión por correo (opción A) actúa
como red de seguridad.

### 4. Roles

El rol por defecto de toda identidad nueva es `cliente`
(`lib/server/clerk-identity.ts`). Para promover a alguien:

- **Desde Clerk**: añade `{"role": "gestor"}` a `publicMetadata` del usuario.
  `syncFromClerk()` lo aplica en la siguiente petición y crea el saldo que
  corresponda.
- **Desde el dashboard**: `POST /api/agents` y `POST /api/staff` siguen
  funcionando; ahora crean la identidad en Clerk además de la fila interna.

`unsafeMetadata` **nunca** se lee para el rol: el navegador puede escribirlo.

### 5. Configuración recomendada en el dashboard de Clerk

- Activar verificación de correo obligatoria.
- Activar protección contra contraseñas filtradas.
- Activar bot protection (Turnstile) — la CSP ya lo permite.
- En producción con dominio propio, definir
  `NEXT_PUBLIC_CLERK_FRONTEND_API_URL`; si falta, la CSP bloquea el SDK.

## Bugs del sistema anterior que desaparecen

Del análisis previo, la migración resuelve por construcción:

- **#1** El registro ya no pasa por `/api/auth/signup`, así que
  `PUBLIC_RATE_LIMIT_SALT` deja de poder tumbarlo. *(La variable sigue haciendo
  falta para el resto de endpoints públicos.)*
- **#2** No hay selector de rol en el registro: se acabó el desajuste
  `gestor`/`cliente`.
- **#3** Trigger `on_auth_user_created` eliminado; `phone` pasa a nullable con
  índice único parcial.
- **#4** Clerk gestiona la verificación de correo entera. No hace falta callback
  ni plantilla con `{{ .Token }}`.
- **#5** Un registro abandonado ya no bloquea el correo: el perfil interno se
  crea al entrar, no al registrarse.
- **#6** El callejón sin salida al verificar desaparece con el flujo de Clerk.
- **#7 y #8** Rutas `/api/auth/*` y `/api/otp` eliminadas.
- **#9** `proxy.ts` refresca la sesión en cada petición.
- **#10** Recuperación de contraseña incluida en `<SignIn />`.
- **#11** El portal de desarrolladores usa el mismo `<SignUp />`.
- **#12** Se acabó la lista blanca de dominios de correo.

Siguen pendientes, porque no dependen del proveedor de identidad:

- **#13** Enumeración de cuentas — ahora depende de la configuración de Clerk.
- **#14** El límite de 10/hora por IP sigue aplicando a los endpoints públicos
  que quedan.
- **#19** `scripts/fix-missing-profiles.ts` usa `role: 'client'`, valor inválido.
  El script ya no aplica al nuevo modelo; conviene borrarlo o reescribirlo.
