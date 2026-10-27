# API Externa FondosEG

Guia tecnica en espanol para conectar una aplicacion externa con FondosEG.

## Objetivo

Esta API externa permite:

- consultar saldo disponible
- realizar transferencias de gestores
- consultar historial
- realizar transferencias entre billeteras de clientes

## Autenticacion

Todas las rutas externas usan estos headers:

```http
x-api-key: TU_API_KEY
x-api-secret: TU_API_SECRET
Content-Type: application/json
```

La validacion se hace en `lib/api-auth.ts`.

## Aplicaciones y credenciales

Las credenciales se emiten **por aplicación**, no por rol ni por el teléfono de
una cuenta. Cada aplicación (por ejemplo CasasEG) nace con su propia billetera
FondosEG: los cobros entran en ella y los envíos salen de ella. Se gestiona en el
portal de desarrolladores (`/developers` o `/developer-console`, pestaña
*Aplicaciones*) o con estas rutas del portal (sesión de desarrollador):

```http
POST /api/applications
```

```json
{ "name": "CasasEG", "description": "Cobro de alquileres" }
```

```http
POST /api/api-keys
```

```json
{
  "application_id": "uuid-de-la-aplicacion",
  "environment": "test",
  "permissions": { "balance": true, "transfer": true, "history": true, "payments": true }
}
```

Respuesta (el `api_secret` solo aparece aquí):

```json
{
  "success": true,
  "apiKey": {
    "id": "uuid",
    "application_id": "uuid-de-la-aplicacion",
    "app_name": "CasasEG",
    "environment": "test",
    "api_key": "sk_test_xxx",
    "api_secret": "xxx",
    "permissions": { "balance": true, "transfer": true, "history": true, "payments": true, "properties": false },
    "created_at": "2026-10-26T10:00:00.000Z"
  }
}
```

Notas:

- `environment = production` solo lo emiten administradores; `test` responde con datos simulados.
- sin `permissions`, la credencial recibe saldo, envíos, historial y cobros.
- los webhooks también se registran por aplicación (`POST /api/webhooks` con `application_id`).
- las aplicaciones creadas por el superadmin quedan *verificadas* y pueden pedir vínculos de billetera.
- las credenciales anteriores siguen funcionando: la migración `20261026_api_applications.sql`
  las agrupa en aplicaciones que conservan la billetera que ya operaban.

## 1. Consultar saldo

Ruta:

```http
GET /api/v1/external/balance
```

### Respuesta para gestor

```json
{
  "success": true,
  "data": {
    "role": "gestor",
    "balance": 250000,
    "cash_balance": 50000,
    "currency": "XAF",
    "formatted": "250.000 XAF"
  }
}
```

### Respuesta para cliente

```json
{
  "success": true,
  "data": {
    "role": "cliente",
    "balance": 80000,
    "currency": "XAF",
    "formatted": "80.000 XAF"
  }
}
```

### Respuesta para admin

```json
{
  "success": true,
  "data": {
    "role": "admin",
    "total_balance": 1250000,
    "currency": "XAF",
    "agents_count": 4,
    "agents": [
      {
        "id": "uuid",
        "name": "Gestor 1",
        "phone": "222000111",
        "balance": 250000,
        "cash_balance": 50000
      }
    ]
  }
}
```

## 2. Consultar historial

Ruta:

```http
GET /api/v1/external/history?limit=50&offset=0
```

Parametros:

- `limit`: cantidad de registros
- `offset`: desplazamiento para paginacion

Comportamiento:

- `admin`: devuelve historial global de `transfers`
- `gestor`: devuelve sus `transfers`
- `cliente`: devuelve `wallet_transfers`

Respuesta:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "limit": 50,
    "offset": 0
  }
}
```

## 3. Realizar transferencia como gestor

Ruta:

```http
POST /api/v1/external/transfer
```

Solo funciona si la API key tiene `role_access = "gestor"` y permiso `transfer = true`.

Body minimo:

```json
{
  "sender_name": "Juan",
  "sender_phone": "222000111",
  "sender_document_type": "dni",
  "sender_document_number": "DOC123",
  "receiver_name": "Maria",
  "receiver_phone": "222999888",
  "receiver_document_type": "dni",
  "receiver_document_number": "DOC999",
  "destination_city": "Malabo",
  "destination_country": "Guinea Ecuatorial",
  "amount": 50000,
  "currency": "XAF",
  "notes": "Entrega familiar"
}
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "transfer_id": "uuid",
    "transfer_code": "ABC123",
    "amount": 50000,
    "currency": "XAF",
    "receiver_name": "Maria",
    "receiver_phone": "222999888",
    "destination_city": "Malabo",
    "status": "available_for_pickup",
    "settled_to_wallet": false,
    "created_at": "2026-04-06T10:30:00.000Z"
  }
}
```

Notas operativas:

- el backend valida saldo del gestor
- el estado depende del beneficiario:
  - sin cuenta en FondosEG: `available_for_pickup` y `settled_to_wallet: false`. El
    `transfer_code` es el vale que se presenta en ventanilla.
  - con cuenta en FondosEG: `completed` y `settled_to_wallet: true`. El importe se abona
    en su billetera al crear el envio y el `transfer_code` queda solo como referencia: no
    autoriza ninguna entrega de efectivo. Si el titular quiere billetes, genera el mismo
    su codigo de retiro desde su panel.
- la comision del envio se calcula internamente y se guarda en `commission_amount`
- el gestor ve esa comision en el dashboard y en el modal de envio dentro del panel

## 4. Transferencia entre billeteras

Ruta:

```http
POST /api/v1/external/wallet-transfer
```

Envía desde la billetera de la aplicación a la de un cliente FondosEG. Requiere
permiso `transfer` y el header `idempotency-key`.

Body:

```json
{
  "receiver_phone": "+240222999888",
  "receiver_name": "Maria",
  "amount": 10000,
  "currency": "XAF",
  "reference": "LIQ-2026-0042",
  "notes": "Liquidación alquiler octubre"
}
```

Respuesta (`201`):

```json
{
  "success": true,
  "data": {
    "transfer_id": "uuid",
    "transfer_type": "wallet",
    "reference": "LIQ-2026-0042",
    "amount": 10000,
    "currency": "XAF",
    "sender_name": "CasasEG",
    "receiver_name": "Maria",
    "receiver_phone": "+240222999888",
    "status": "completed",
    "created_at": "2026-10-26T10:40:00.000Z",
    "confirmed_at": "2026-10-26T10:40:00.000Z",
    "new_balance": 70000
  }
}
```

Notas (mismas reglas que un envío desde la app de FondosEG):

- el teléfono se normaliza (espacios, guiones, prefijo) y solo se acepta una coincidencia exacta
- solo se puede enviar el saldo **disponible** (`available_balance` en `/balance`)
- la divisa debe ser la de la billetera; no hay conversión
- se liquida al instante, con la evidencia de consentimiento CEMAC en la misma transacción
- un rechazo de negocio responde `422` con `error.details.reason`
  (`receiver_not_found`, `receiver_inactive`, `insufficient_funds`, `currency_mismatch`);
  no se movió dinero y la misma `idempotency-key` puede reutilizarse
- un `503` significa resultado incierto: reintenta con la **misma** `idempotency-key`
- el webhook `wallet_transfer.confirmed` solo llega a las aplicaciones del emisor y del beneficiario

## 5. Solicitudes de cobro (cobrar a un cliente FondosEG)

Permite que tu aplicacion cobre a un cliente desde SU billetera sin guardar
credenciales suyas. El importe se abona en la billetera de la aplicación.

Requisito de la credencial: permiso `payments = true`. La autenticacion admite `x-api-key` o
`Authorization: Bearer <api_key>`, siempre con `x-api-secret`.

### Crear

```http
POST /api/v1/external/payment-requests
```

```json
{
  "orderId": "ORD-2026-0001",
  "paymentReference": "CEG-RENT-20261015-0001",
  "amount": 95000,
  "currency": "XAF",
  "description": "Alquiler octubre",
  "returnUrl": "https://tu-app.com/pagos",
  "metadata": { "propertyId": "..." }
}
```

- `orderId` (o `external_reference`) es obligatorio e idempotente: repetirlo devuelve
  la misma solicitud (200). Repetirlo con otro importe o divisa devuelve 409.
- `returnUrl` debe ser https. Caducidad por defecto: 24 h (`expires_in_minutes`, 5 min a 7 dias).

Respuesta `201`:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "provider_reference": "uuid",
    "reference": "ORD-2026-0001",
    "amount": 95000,
    "currency": "XAF",
    "status": "pending",
    "checkout_url": "https://fondoseg.com/pay/uuid",
    "expires_at": "2026-10-16T10:00:00.000Z"
  }
}
```

Redirige al cliente a `checkout_url`. Alli inicia sesion, revisa el importe y confirma.
El cargo y el abono ocurren en una sola transaccion y una solicitud solo puede
pagarse una vez. El cliente tambien puede rechazarla.

### Consultar y cancelar

```http
GET    /api/v1/external/payment-requests?status=pending&reference=ORD-2026-0001
GET    /api/v1/external/payment-requests/{id}
DELETE /api/v1/external/payment-requests/{id}
```

Estados: `pending`, `paid`, `cancelled`, `expired`.

### Webhooks

Crea la suscripcion en `/developers` -> Webhooks firmados, con los eventos
`payment_request.paid`, `payment_request.cancelled` y
`payment_request.payment_failed`. Solo recibes los eventos de tus propias solicitudes.

`payment_request.payment_failed` avisa de un intento de pago rechazado por saldo
insuficiente (`data.failure_reason = "insufficient_funds"`). La solicitud sigue
`pending`: el cliente puede recargar y reintentar, o el comercio puede retirarla
con `DELETE /api/v1/external/payment-requests/{id}`.

```http
X-FondosEG-Webhook-Event: payment_request.paid
X-FondosEG-Webhook-Timestamp: 1792060000
X-FondosEG-Webhook-Signature: v1=<hex HMAC-SHA256 de "${timestamp}.${body}">
```

```json
{
  "id": "evt-uuid",
  "event": "payment_request.paid",
  "created_at": "2026-10-15T12:00:00.000Z",
  "data": {
    "payment_request_id": "uuid",
    "provider_reference": "uuid",
    "reference": "ORD-2026-0001",
    "amount": 95000,
    "currency": "XAF",
    "status": "paid",
    "wallet_transfer_id": "uuid",
    "paid_at": "2026-10-15T12:00:00.000Z"
  }
}
```

Verifica la firma con 5 minutos de tolerancia y comprueba que `amount`/`currency`
coinciden con tu pedido antes de darlo por pagado.

## 6. Vinculo de billetera (mostrar el saldo del cliente)

Permite que tu app muestre a SU usuario el saldo de su billetera FondosEG antes
de pagar, sin guardar credenciales del cliente. El cliente autoriza una vez; tu
app recibe un token que **solo** permite leer su saldo (`balance:read`): no puede
mover dinero ni leer movimientos. Requiere una credencial `production` con
permiso `payments` de una billetera **cliente** (la misma que cobra).

### 1. Crear la solicitud de vinculo

```http
POST /api/v1/external/wallet-links
Content-Type: application/json

{ "externalUserRef": "id-del-usuario-en-tu-app", "returnUrl": "https://tuapp.com/perfil", "state": "valor-aleatorio-8-128" }
```

Respuesta `201`: `{ "id", "authorize_url", "expires_at" }` (15 minutos). Guarda
`state` asociado a tu usuario y lleva al cliente a `authorize_url`.

### 2. El cliente autoriza

En `fondoseg.com/link/{id}` el cliente inicia sesion y pulsa Autorizar o
Rechazar. FondosEG vuelve a tu `returnUrl` con:

- `?fondoseg_link=<code>&state=<state>` si autoriza (codigo de un solo uso, 10 minutos);
- `?fondoseg_link_error=denied&state=<state>` si rechaza.

Comprueba que `state` es el que guardaste para ese usuario antes de seguir.

### 3. Canjear el codigo por el token (desde tu servidor)

```http
POST /api/v1/external/wallet-links/token
Content-Type: application/json

{ "code": "<code>" }
```

Respuesta `201`: `{ "link_id", "access_token", "scopes": ["balance:read"], "wallet_phone_masked" }`.
`access_token` (`wlt_live_...`) solo se muestra esta vez: guardalo cifrado en tu
servidor y nunca lo envies al navegador. Un codigo ya usado o caducado responde `409`.

### 4. Leer el saldo

```http
GET /api/v1/external/wallet-links/balance
X-Wallet-Link-Token: wlt_live_...
```

Respuesta `200`: `{ "available": 400000, "currency": "XAF", "as_of": "..." }`.
Si el cliente retiro el acceso (desde su perfil -> Apps conectadas) responde
`401` con `error.code = "link_revoked"`: marca el vinculo como inactivo y ofrece
vincular de nuevo.

### 5. Revocar desde tu app

```http
DELETE /api/v1/external/wallet-links/{link_id}
```

Vincular de nuevo al mismo cliente revoca el vinculo anterior automaticamente.

## Errores comunes

### 401

```json
{
  "error": "API key y secret son requeridos"
}
```

o

```json
{
  "error": "API secret incorrecto"
}
```

### 403

```json
{
  "error": "Permiso denegado: transfer"
}
```

o

```json
{
  "error": "Solo gestores pueden realizar transferencias"
}
```

### 400

```json
{
  "error": "Faltan campos requeridos"
}
```

o

```json
{
  "error": "Saldo insuficiente"
}
```

## Recomendacion de integracion

Una aplicación por producto. Para cobrar a clientes y pagarles (caso CasasEG):

- crea la aplicación y sus credenciales en el portal
- `POST /api/v1/external/payment-requests` para cobrar
- `GET /api/v1/external/payment-requests/{id}` o el webhook `payment_request.paid` para confirmar
- `POST /api/v1/external/wallet-transfer` para pagar desde el saldo de la aplicación
- `GET /api/v1/external/balance` y `GET /api/v1/external/history` para conciliar

Guía completa paso a paso: [guia-integracion-casaseg-es.md](guia-integracion-casaseg-es.md).

`POST /api/v1/external/transfer` (envío de gestor con código de ventanilla) solo
funciona con credenciales de gestor emitidas antes de las aplicaciones.

## Recomendaciones antes de produccion

- no llamar estas rutas directamente desde el frontend publico de la otra app
- consumirlas desde el backend de la otra aplicacion
- guardar `api_secret` solo en variables seguras del servidor
- activar idempotencia en rutas de transferencia para evitar duplicados por reintentos
- documentar versionado de la API si vas a abrirla a terceros

## Estado actual

Ya implementado:

- autenticacion por `x-api-key` y `x-api-secret`
- generacion de credenciales
- consulta de saldo
- consulta de historial
- transferencias de gestores
- transferencias entre billeteras

- idempotencia obligatoria (`idempotency-key`) en transferencias; si Postgres rechaza
  la operacion (p. ej. saldo insuficiente) la clave se libera y se puede reintentar
- solicitudes de cobro con pagina de checkout y webhooks `payment_request.*`
- gestion de webhooks desde la consola de desarrolladores

Pendiente recomendado:

- documentacion OpenAPI alineada con estas rutas externas
- ejemplos oficiales para Postman o Insomnia
