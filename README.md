# FondosEG — Plataforma de Envíos, Billetera y API de Pagos

FondosEG es una plataforma financiera para **envío de dinero en la zona CEMAC**. Cubre tres
productos sobre una misma base de datos:

1. **Dashboard operativo** — gestores y administradores crean envíos, gestionan saldos,
   liquidan efectivo en ventanilla y siguen la actividad en tiempo real.
2. **Billetera de cliente** — el cliente registrado tiene custodia de su saldo: recibe envíos
   liquidados en el acto, envía dinero a otros clientes y emite sus propios vales de retiro.
3. **Plataforma API pública** — integradores externos consumen balance, historial,
   transferencias, alquileres y pagos con credenciales propias, entornos `test`/`production`,
   idempotencia, rate limit y webhooks firmados.

---

## 🚀 Stack

| Capa | Tecnología |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Server Components, Server Actions) |
| UI | React 19.2, [Tailwind CSS 4](https://tailwindcss.com/), Radix UI, `lucide-react`, `framer-motion` |
| Identidad | [Clerk](https://clerk.com/) (`@clerk/nextjs` v7, localización `esES`) |
| Datos | [Supabase](https://supabase.com/) PostgreSQL — acceso **exclusivamente** con service-role desde el servidor |
| Estado | [Zustand](https://github.com/pmndrs/zustand) (`lib/store.ts`) |
| Validación | [Zod 4](https://zod.dev/) + `react-hook-form` + `@hookform/resolvers` |
| Gráficos | [Recharts 3](https://recharts.org/) |
| Notificaciones | [Twilio](https://www.twilio.com/) (SMS) y [Resend](https://resend.com/) (correo) |
| Pagos externos | Revolut Payout Links + proveedor de pagos genérico vía webhooks firmados |
| Documentación API | OpenAPI 3 generado en runtime (`@asteasolutions/zod-to-openapi`) + `swagger-ui-react` |
| Tests | Runner nativo de Node (`node --test`) sobre TypeScript sin compilar |

---

## 🔐 Identidad y autorización

**Clerk sustituyó a Supabase Auth** (ver [docs/clerk-migration.md](docs/clerk-migration.md)).
El puente entre ambos mundos es la columna `public.users.clerk_user_id`; el `id` interno sigue
siendo el mismo UUID de siempre, así que **ningún dato histórico se perdió**.

- [proxy.ts](proxy.ts) — el middleware de Next 16 se llama ahora `proxy.ts`. Monta
  `clerkMiddleware()` y **no** hace *path matching*: su única función es dejar `auth()`
  disponible en el servidor y refrescar la cookie de sesión en cada petición.
- [lib/server/authz.ts](lib/server/authz.ts) — la autorización real es **por recurso**:
  `requireAuthUser()`, `requireProfile()`, `requireProductAccess()`. Cada ruta de API la invoca.
- [lib/server/clerk-identity.ts](lib/server/clerk-identity.ts) — resuelve el perfil interno
  desde la sesión verificada de Clerk y aprovisiona *just-in-time* en el primer acceso.
- **Acceso por producto** (`account_access`): `dashboard` y `developer_portal` son grants
  independientes. Un desarrollador no entra al dashboard operativo y viceversa.
- **Roles**: `superadmin`, `admin`, `gestor`, `cliente` (+ `developer` como rol de acceso),
  definidos en [lib/roles.ts](lib/roles.ts).
- **CSP estricta** generada en [next.config.ts](next.config.ts): el host del Frontend API de
  Clerk se **deriva de la publishable key** (va en base64 dentro de ella) para que dos variables
  no acaben desincronizándose. Incluye HSTS, `frame-ancestors 'none'`, `object-src 'none'` y
  una `Permissions-Policy` restrictiva.
- **Mutaciones same-origin** y límites de payload contados en bytes UTF-8:
  [lib/security/request-policy.ts](lib/security/request-policy.ts).

---

## 💸 Modelo financiero

### Envío de gestor (`transfers`)

Ciclo de vida: `created` → `available_for_pickup` → `paid_out` → `completed` (o `cancelled`).
La comisión se calcula con la **tarifa nacional versionada** de
[lib/financial.ts](lib/financial.ts) (`NATIONAL_TARIFF_VERSION`, 13 tramos de 1 000 a
2 000 000 XAF), y cada envío guarda el `pricing_rule_code` que se le aplicó.

Si el beneficiario **es un cliente registrado**, el envío se liquida directamente en su
billetera (`wallet_credited_at`) y deja de estar disponible para retiro en ventanilla.

### Envío entre clientes (`wallet_transfers`)

Desde `20260826_wallet_transfer_instant_settlement.sql` la entrega es **inmediata**: el saldo
del emisor baja y el del beneficiario sube en la misma transacción, y la orden nace `confirmed`.
Ya no hay código de verificación ni retención — `verification_code` admite NULL en los envíos
instantáneos (`20260827`).

### Retiro de efectivo (`client_withdrawals`)

Es el único documento que autoriza a un gestor a entregar efectivo contra la billetera de un
cliente, y lo emite **el propio titular**: se genera un código con CSPRNG, el importe queda
retenido en `client_balances.reserved_balance` y caduca a las
`CLIENT_WITHDRAWAL_EXPIRY_HOURS` (72 h), momento en el que la retención se libera sola.

### Saldos

- `agent_balances` — flotante del gestor + `cash_balance` (efectivo en caja).
- `client_balances` — `balance` y `reserved_balance`; el disponible se calcula siempre con
  `getAvailableClientBalance()`.
- Toda operación que mueve dinero pasa por RPCs atómicas en
  [lib/server/financial-operations.ts](lib/server/financial-operations.ts); los errores SQL
  se traducen a mensajes en español antes de llegar al usuario.

### Payouts externos

- **Revolut Payout Links** — [lib/server/revolut.ts](lib/server/revolut.ts), firma JWT con clave
  privada (ver [docs/revolut-jwks.md](docs/revolut-jwks.md)).
- **Proveedor de pagos genérico** — [lib/server/payments-provider.ts](lib/server/payments-provider.ts),
  HMAC en ambos sentidos para cobros de alquiler.

---

## 🧭 Cumplimiento normativo (CEMAC)

Implementado sobre el **Reglamento 04/18/CEMAC/UMAC/COBAC**
([lib/compliance.ts](lib/compliance.ts)):

- Consentimiento y divulgación versionada (`disclosure_version`) antes de confirmar una orden.
- Tabla `compliance_events` con la trazabilidad de cada consentimiento.
- Panel `/compliance` con los controles y el **registro de reclamaciones**
  (referencia `REC-YYYYMMDD-XXXXXXXX`, objetivo de resolución de 15 días).
- **Recibos imprimibles** por operación en `/receipts/[id]`.
- Documentos legales (términos, privacidad, cookies, políticas) en
  [lib/legal-content.ts](lib/legal-content.ts), servidos en `/privacy`, `/cookies` y `/policies`.

---

## 🌐 API pública para integradores

**Versión estable: `/api/v1/external`**. Las rutas de `/api/external` son la implementación y
`v1` las reexporta, de modo que la superficie versionada nunca rompe.

| Endpoint | Permiso |
| --- | --- |
| `GET /api/v1/external/balance` | `balance` |
| `GET /api/v1/external/history` | `history` |
| `POST /api/v1/external/transfer` | `transfer` |
| `POST /api/v1/external/wallet-transfer` | `transfer` |
| `GET /api/v1/external/properties` | `properties` |
| `GET /api/v1/external/rentals` | `properties` |
| `POST /api/v1/external/rental-payments` | `payments` |

### Características de plataforma

- Autenticación por cabeceras `x-api-key` + `x-api-secret`; el secreto se guarda **hasheado** y
  sólo se muestra completo al crearlo o rotarlo.
- **Entornos por credencial**: `sk_test_` responde desde el sandbox
  ([lib/server/public-api-sandbox.ts](lib/server/public-api-sandbox.ts)) sin mover dinero real;
  `sk_live_` opera sobre saldos reales.
- **Idempotencia** (`api_idempotency_keys`) en toda operación que mueve dinero.
- **Rate limit** por ventana deslizante (`api_key_usage_windows`), con cabeceras
  `x-ratelimit-limit` / `-remaining` / `-reset`.
- **Sobre de respuesta uniforme** — `{ success, data, pagination?, meta?, request_id }` y un
  catálogo cerrado de códigos de error (`validation_error`, `permission_denied`,
  `idempotency_conflict`, `business_rule_failed`, …).
- **Observabilidad**: cada petición se registra en `api_request_logs` con `request_id`, latencia
  y código de error.
- **Webhooks firmados** con el secreto cifrado en reposo y cola de reintentos
  (`webhook_subscriptions`, `webhook_deliveries`). Eventos: `transfer.created`,
  `transfer.paid_out`, `transfer.revolut_payout_link_created`, `wallet_transfer.confirmed` y el
  ciclo completo de `rental_payment.*`.
- **OpenAPI 3** generado en runtime en `GET /api/docs/openapi.json`, con visor en
  `/documentation`.
- **SDK oficial de TypeScript** en [sdk/typescript/fondoseg-sdk](sdk/typescript/fondoseg-sdk)
  (cliente tipado, idempotencia automática, reintentos y verificación de webhooks).
- **Supabase Edge Functions** de ejemplo en [supabase/functions](supabase/functions).

### Portal de desarrolladores

Flujo completo y separado del dashboard: `/developers-portal` (público) →
`/developers-portal/register` o `/login` → consola autenticada en `/developers`, donde se
generan y rotan credenciales, se consulta la actividad reciente y se configuran webhooks.

---

## 🖥️ Superficie de la aplicación

### Dashboard (`app/(dashboard)`)

| Ruta | Admin / Superadmin | Cliente |
| --- | --- | --- |
| `/dashboard` | Métricas, liquidez y comisiones | Resumen de billetera |
| `/transfers` | Envíos | Enviar dinero |
| `/agents` | Gestores y recargas | — |
| `/balance` | Saldos y conciliación | Billetera y retiros |
| `/stats` | Estadísticas | — |
| `/history` | Historial | Actividad |
| `/staff` | Administración (**sólo superadmin**) | — |
| `/profile`, `/compliance`, `/receipts/[id]`, `/privacy`, `/cookies`, `/policies` | ✔ | ✔ |

### Marketing y acceso

- Landings segmentadas: `/landing/gestores`, `/landing/aliados`, `/landing/developers`, más
  páginas de contenido dinámicas en `/landing/[slug]` (prerenderizadas con
  `generateStaticParams`).
- Autenticación propia en `/login` y `/register` — pantallas de Clerk con `appearance` a medida,
  no el Account Portal alojado.
- Alta guiada en `/onboarding`, con reparación automática de perfiles a medio aprovisionar.
- Pantallas de estado dedicadas: `/forbidden`, `/unauthorized`, `/connection`, `/force-signout`,
  además de `ServiceUnavailableScreen` y `PendingApprovalScreen`.

### Experiencia

- Tema claro / oscuro / sistema sin parpadeo (script inyectado `beforeInteractive`).
- Diseño móvil de primera clase: `viewportFit: cover` con `env(safe-area-inset-*)` e
  `interactiveWidget: "resizes-content"`, para que `100dvh` y los modales se comporten con el
  teclado virtual abierto.
- Búsqueda global (`SearchModal`), centro de notificaciones, panel de usuarios conectados,
  modal de soporte, consentimiento de cookies y ajustes — todos desde la cabecera.
- Skeletons de carga centralizados en
  [components/skeletons/app-skeletons.tsx](components/skeletons/app-skeletons.tsx).

---

## 📬 Notificaciones y soporte

- **Outbox de notificaciones** (`notification_outbox`) — desacopla el envío del SMS de la
  transacción financiera. Se drena con `processNotificationOutbox()`.
- **SMS por Twilio**, con soporte de Messaging Service y remitente alfanumérico.
- **Correo por Resend** — OTP, bienvenida y solicitudes de soporte
  ([lib/email-service.ts](lib/email-service.ts)).
- **Bandeja de soporte por IMAP** — `syncSupportInbox()` importa las respuestas del buzón a
  `support_messages` (ver [docs/spacemail-support-inbox.md](docs/spacemail-support-inbox.md)).
- **Notificaciones internas** con estado de lectura por usuario: `/api/me/notifications*`.

### Workers

Protegidos por secreto compartido (`Authorization: Bearer <secreto>`):

```bash
POST /api/webhooks/process      # drena webhook_deliveries   (WEBHOOK_WORKER_SECRET)
POST /api/support/email-sync    # sincroniza el buzón IMAP    (SUPPORT_EMAIL_SYNC_SECRET)
```

---

## 🛠️ Instalación y desarrollo

### 1. Requisitos

Node 20+, un proyecto de Supabase y una instancia de Clerk. El repo trae `bun.lock`, pero
`npm install` funciona igual.

### 2. Instalar

```bash
npm install
```

### 3. Variables de entorno

Copia [.env.example](.env.example) a `.env` y rellena:

#### Obligatorias

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # server-only
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=                     # server-only
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
```

#### Secretos de plataforma

```env
PUBLIC_RATE_LIMIT_SALT=               # >= 32 bytes aleatorios
WEBHOOK_ENCRYPTION_KEY=               # cifra los secretos de webhook en reposo
WEBHOOK_WORKER_SECRET=
SUPPORT_EMAIL_SYNC_SECRET=
```

#### Integraciones opcionales

```env
# Twilio
TWILIO_ACCOUNT_SID= / TWILIO_AUTH_TOKEN= / TWILIO_PHONE_NUMBER=
TWILIO_MESSAGING_SERVICE_SID= / TWILIO_ALPHANUMERIC_SENDER_ID=

# Resend (verifica el dominio antes de enviar correo real)
RESEND_API_KEY=
RESEND_FROM_EMAIL="FondosEG <no-reply@fondoseg.com>"

# Revolut
REVOLUT_ENV= / REVOLUT_CLIENT_ID= / REVOLUT_PRIVATE_KEY= / REVOLUT_ACCOUNT_ID=
REVOLUT_ACCESS_TOKEN= / REVOLUT_REFRESH_TOKEN= / REVOLUT_API_BASE_URL=
REVOLUT_REDIRECT_DOMAIN= / REVOLUT_PAYOUT_METHODS= / REVOLUT_PAYOUT_EXPIRY_PERIOD=

# Proveedor de pagos (alquileres)
PAYMENTS_PROVIDER_NAME= / PAYMENTS_PROVIDER_BASE_URL=
PAYMENTS_PROVIDER_API_KEY= / PAYMENTS_PROVIDER_API_SECRET= / PAYMENTS_PROVIDER_WEBHOOK_SECRET=

# Buzón de soporte (IMAP)
SUPPORT_EMAIL= / SUPPORT_EMAIL_IMAP_HOST= / SUPPORT_EMAIL_IMAP_PORT=
SUPPORT_EMAIL_IMAP_MAILBOX= / SUPPORT_EMAIL_MARK_SEEN=

# Sólo con dominio propio de Clerk detrás de un proxy
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=
```

> `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` se leen **en tiempo de
> compilación** para construir la CSP. Si faltan, los avatares y el script de Clerk se bloquean
> en silencio — `next.config.ts` lo avisa por consola.

### 4. Base de datos

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
# después, en orden cronológico:
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Scripts auxiliares — ejecución **manual**, nunca como migración:

- `supabase/create_admin.sql` — crea el primer superadmin.
- `supabase/provision_payments_integration.sql` — provisiona la integración de pagos.
- `supabase/reset_transactional_data.sql` — **irreversible**: vacía dinero e historial y
  conserva usuarios, roles y accesos.

### 5. Arrancar

```bash
npm run dev        # http://localhost:3001
```

---

## 📜 Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Dev server en el puerto 3001 vía `scripts/dev-next.cjs` |
| `npm run build` | Build de producción vía `scripts/build-next.cjs` |
| `npm start` | Servidor de producción en el puerto 3001 |
| `npm run lint` | ESLint 9 (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `node --test --experimental-strip-types tests/**/*.test.ts` |

> **Por qué `dev-next.cjs` y `build-next.cjs`**: el binario nativo de SWC/LightningCSS no está
> disponible en este entorno Windows. Los scripts enlazan `lightningcss-wasm`, activan
> `CSS_TRANSFORMER_WASM=1`, fuerzan el compilador webpack y filtran el ruido de los avisos de
> binario nativo. **Usa siempre `npm run dev`, no `next dev` a pelo.**

Scripts de operación en [scripts/](scripts/):

- `import-users-to-clerk.mjs` — migra las cuentas existentes a Clerk conservando el hash.
- `fix-missing-profiles.ts` — repara perfiles sin fila en `public.users`.
- `generate-revolut-jwks.js` — genera el JWKS para la integración de Revolut.

---

## 🧪 Tests

Suite de **contrato y regresión** con el runner nativo de Node, sin build previo:

| Fichero | Cubre |
| --- | --- |
| `tests/auth/clerk-session-resolution.test.ts` | Resolución de sesión sin llamadas de más a Clerk |
| `tests/onboarding/redirect-regressions.test.ts` | Alta, activación y perfiles a medio aprovisionar |
| `tests/security/request-policy.test.ts` | Same-origin, fetch metadata y límites en bytes |
| `tests/security/security-regressions.test.ts` | Escalada de rol, autorización por recurso, CSP |
| `tests/client-balance-flow.contract.test.ts` | Liquidación en billetera vs. retiro en ventanilla |
| `tests/wallet/client-withdrawal.contract.test.ts` | Retención, pago atómico, caducidad y CSPRNG |
| `tests/wallet/transfer-regressions.test.ts` | Envío entre clientes y avisos al beneficiario |

---

## 📂 Estructura

```text
app/
  (auth)/              Login y registro (Clerk con pantallas propias)
  (dashboard)/         Dashboard operativo y billetera de cliente
  (developer)/         Consola de desarrolladores
  developers-portal/   Portal público de integradores
  landing/             Marketing segmentado + contenido dinámico [slug]
  onboarding/          Alta guiada
  actions/             Server Actions (perfil, onboarding)
  api/                 Rutas internas, API pública v1 y workers
components/
  auth/ layout/ marketing/ providers/ skeletons/ ui/  + modales de operación
lib/
  server/              Frontera de servidor: authz, identidad Clerk, operaciones
                       financieras, API pública, webhooks, outbox, Revolut, IMAP
  security/            Políticas de petición
  supabase/            Cliente admin y traducción de errores
  financial.ts         Tarifas versionadas, ciclos de vida y métricas de liquidez
  compliance.ts        Reglamento CEMAC y reclamaciones
services/              Capa de acceso a datos y clientes HTTP tipados
modules/               Monolito modular incremental (ver modules/README.md)
shared/                Código transversal (auth, base de datos)
sdk/typescript/        SDK oficial para integradores
supabase/              schema.sql, migrations/, functions/ y scripts operativos
tests/                 Tests de contrato y regresión
docs/                  Guías de API, migración a Clerk, Revolut y runbooks
scripts/               Arranque, build y utilidades de operación
```

---

## 📚 Documentación

| Documento | Contenido |
| --- | --- |
| [docs/fondoseg-api-documentation-es.md](docs/fondoseg-api-documentation-es.md) | Referencia completa de la API pública |
| [docs/fondoseg-public-api-guide.md](docs/fondoseg-public-api-guide.md) | Guía de integración paso a paso |
| [docs/external-api-integration-es.md](docs/external-api-integration-es.md) | Integración desde otra aplicación |
| [docs/api-platform-analysis.md](docs/api-platform-analysis.md) | Estado de madurez por módulo |
| [docs/clerk-migration.md](docs/clerk-migration.md) | Migración de Supabase Auth a Clerk |
| [docs/revolut-jwks.md](docs/revolut-jwks.md) · [docs/revolut-payout-links.md](docs/revolut-payout-links.md) | Integración con Revolut |
| [docs/security-rotation-runbook.md](docs/security-rotation-runbook.md) | Rotación de secretos |
| [docs/spacemail-support-inbox.md](docs/spacemail-support-inbox.md) | Buzón de soporte por IMAP |
| [modules/README.md](modules/README.md) | Reglas de dependencia del monolito modular |

---

## 🧱 Convenciones

- **Nunca** un cliente de Supabase con anon key en el servidor: el acceso a datos es
  service-role y la autorización vive en `lib/server/authz.ts`.
- **Nunca** confiar en el id que llega en un formulario: se toma siempre de la sesión.
- Todo lo que mueve dinero pasa por una RPC atómica; nada se compone con varios `update`.
- Alias de import `@/*` sobre la raíz del proyecto.
- Los errores de PostgreSQL se traducen a español antes de mostrarse al usuario.
- Las rutas del dashboard son `dynamic = 'force-dynamic'`: dependen de la sesión y no se pueden
  prerenderizar.

---

*Plataforma financiera para la zona CEMAC — construida con foco en atomicidad contable,
trazabilidad normativa y una experiencia móvil de primera.*
