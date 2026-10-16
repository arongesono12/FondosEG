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

## Crear credenciales

Ruta:

```http
POST /api/api-keys
```

Body:

```json
{
  "app_name": "CasasEG",
  "app_description": "Integracion movil o web",
  "role_access": "gestor",
  "permissions": {
    "balance": true,
    "transfer": true,
    "history": true
  }
}
```

Notas:

- `role_access` puede ser `admin`, `superadmin`, `gestor` o `cliente`.
- por defecto el sistema crea permisos de `balance` e `history`
- el permiso `transfer` se activa automaticamente para `gestor`
- si tu otra app necesita operar como cliente y como gestor, conviene crear dos credenciales separadas

Respuesta esperada:

```json
{
  "success": true,
  "apiKey": {
    "id": "uuid",
    "app_name": "CasasEG",
    "api_key": "key_xxx",
    "api_secret": "secret_xxx",
    "role_access": "gestor",
    "permissions": {
      "balance": true,
      "transfer": true,
      "history": true
    },
    "created_at": "2026-04-06T10:00:00.000Z"
  }
}
```

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

Solo funciona si la API key tiene `role_access = "cliente"` y permiso `transfer = true`.

Body:

```json
{
  "receiver_phone": "222999888",
  "receiver_name": "Maria",
  "amount": 10000,
  "currency": "XAF",
  "notes": "Pago interno"
}
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "transfer_id": "uuid",
    "transfer_type": "wallet",
    "amount": 10000,
    "currency": "XAF",
    "sender_name": "Juan",
    "sender_phone": "222000111",
    "receiver_name": "Maria",
    "receiver_phone": "222999888",
    "status": "completed",
    "created_at": "2026-04-06T10:40:00.000Z",
    "new_balance": 70000
  }
}
```

Notas:

- esta operacion se confirma inmediatamente
- descuenta saldo de la billetera del emisor
- acredita saldo a la billetera del receptor

## 5. Solicitudes de cobro (cobrar a un cliente FondosEG)

Permite que tu aplicacion cobre a un cliente desde SU billetera sin guardar
credenciales suyas. El importe se abona en la billetera del dueno de la API key.

Requisitos de la credencial: `role_access = "cliente"` y permiso `payments = true`
(opt-in: hay que marcarlo al crearla). La autenticacion admite `x-api-key` o
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

### Si tu otra app es para gestores

Usa:

- `POST /api/api-keys` con `role_access = "gestor"`
- `GET /api/v1/external/balance`
- `GET /api/v1/external/history`
- `POST /api/v1/external/transfer`

### Si tu otra app es para clientes

Usa:

- `POST /api/api-keys` con `role_access = "cliente"`
- `GET /api/v1/external/balance`
- `GET /api/v1/external/history`
- `POST /api/v1/external/wallet-transfer`

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
