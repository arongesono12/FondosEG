# Documentacion de Integracion - FondosEG Public API

Guia completa para integrar aplicaciones externas con FondosEG mediante API HTTP, SDK TypeScript y webhooks firmados.

## Resumen

La API publica de FondosEG permite que otras aplicaciones puedan:

- consultar saldos segun el rol de la credencial;
- crear transferencias de gestores;
- crear transferencias directas entre billeteras de clientes;
- consultar historial paginado y filtrado;
- recibir eventos por webhooks firmados.

La integracion debe hacerse siempre desde un backend seguro. No expongas `x-api-secret` en aplicaciones web publicas, apps moviles, repositorios, logs o herramientas de analitica.

FondosEG supports two environments per credential:

- `test`: entorno sandbox para pruebas, no mueve dinero real.
- `production`: entorno real, opera sobre saldos y transferencias productivas.

## URLs y Versionado

| Entorno | Base URL |
| --- | --- |
| Desarrollo local | `http://localhost:3001` |
| Produccion | Dominio configurado en `NEXT_PUBLIC_APP_URL` |

La version estable actual es:

```text
/api/v1/external
```

Rutas historicas bajo `/api/external` pueden seguir funcionando por compatibilidad, pero las nuevas integraciones deben usar `/api/v1/external`.

Contrato OpenAPI:

```text
GET /api/docs/openapi.json
```

## Portal de Desarrolladores

Los integradores gestionan su acceso desde:

| Uso | Ruta |
| --- | --- |
| Portal publico | `/developers-portal` |
| Registro | `/developers-portal/register` |
| Login | `/developers-portal/login` |
| Consola autenticada | `/developers` |
| OpenAPI | `/api/docs/openapi.json` |

Flujo recomendado:

1. El desarrollador crea o inicia sesion en el portal.
2. Entra a la consola `/developers`.
3. Genera una credencial para su aplicacion.
4. Configura permisos y webhooks.
5. Consume la API desde el backend de su aplicacion.

## Autenticacion

Cada request externo debe incluir:

```http
x-api-key: sk_...
x-api-secret: ...
accept: application/json
```

Para requests con body JSON:

```http
content-type: application/json
```

El `api_secret` completo se muestra solo una vez al crear o rotar la credencial. Guardalo como secreto de servidor.

Las API keys nuevas usan prefijos por entorno:

| Entorno | Prefijo |
| --- | --- |
| `test` | `sk_test_` |
| `production` | `sk_live_` |

## Roles y Permisos

La API key tiene un `role_access` y permisos por operacion.

| Rol | Uso habitual | Endpoints principales |
| --- | --- | --- |
| `gestor` | Agentes que crean transferencias de efectivo | Balance, history, transfer |
| `cliente` | Usuarios con billetera FondosEG | Balance, history, wallet-transfer |
| `admin` | Operacion interna y supervision | Balance global, history global |
| `superadmin` | Operacion interna avanzada | Balance global, history global |

Permisos:

| Permiso | Descripcion |
| --- | --- |
| `balance` | Permite consultar saldos |
| `history` | Permite consultar historial |
| `transfer` | Permite crear movimientos |

Si una aplicacion necesita operar como gestor y como cliente, usa credenciales separadas.

## Entornos de API

Cada credencial pertenece a un solo entorno.

| Entorno | Uso | Efecto |
| --- | --- | --- |
| `test` | Pruebas de integracion, QA, demos | Devuelve saldos/historial sandbox y simula transferencias sin afectar saldos reales |
| `production` | Operacion real | Ejecuta consultas y movimientos sobre datos productivos |

Recomendaciones:

- usa credenciales `test` durante desarrollo y certificacion;
- usa credenciales `production` solo desde servidores productivos;
- no mezcles una misma credencial en ambos entornos;
- valida en tus logs el header `x-api-environment`;
- separa variables de entorno, por ejemplo `FONDOSEG_TEST_API_KEY` y `FONDOSEG_PROD_API_KEY`.

En entorno `test`, las operaciones monetarias responden con `201 Created`, respetan validacion e idempotencia, pero no crean transferencias reales ni emiten webhooks productivos.

## Headers de Respuesta

Todas las respuestas externas incluyen:

```http
x-request-id: <uuid>
x-api-version: v1
x-api-environment: test
cache-control: no-store, max-age=0
```

Cuando la credencial ya fue autenticada, tambien se devuelven headers de rate limit:

```http
x-ratelimit-limit: 100
x-ratelimit-remaining: 97
x-ratelimit-reset: 2026-05-31T19:00:00.000Z
```

Si se supera el limite:

```http
retry-after: 42
```

Usa `x-request-id` para soporte, trazabilidad y conciliacion de incidencias.

## Rate Limiting

Cada API key tiene un limite configurable por ventana de tiempo. Si se supera, la API devuelve:

```http
HTTP/1.1 429 Too Many Requests
```

```json
{
  "success": false,
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit excedido. Intenta de nuevo despues de 42 segundos"
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

Recomendaciones:

- respeta `retry-after`;
- aplica backoff exponencial en `429` y `5xx`;
- evita reintentos infinitos;
- usa idempotencia en operaciones monetarias.

## Idempotencia

Las operaciones que mueven dinero aceptan:

```http
idempotency-key: 9a3e8e98-2d5d-48c4-9584-0d2b5b46e9c1
```

Endpoints que deben usar idempotencia:

- `POST /api/v1/external/transfer`
- `POST /api/v1/external/wallet-transfer`

Comportamiento:

- si repites la misma clave con el mismo payload, FondosEG devuelve la respuesta cacheada;
- si repites la misma clave con un payload distinto, devuelve `409 idempotency_conflict`;
- la clave debe representar un intento logico de negocio, no cada retry HTTP.

Ejemplo:

```bash
curl -X POST "http://localhost:3001/api/v1/external/transfer" \
  -H "content-type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>" \
  -H "idempotency-key: 9a3e8e98-2d5d-48c4-9584-0d2b5b46e9c1" \
  -d '{"sender_name":"Juan","sender_phone":"+240000000000","receiver_name":"Maria","receiver_phone":"+240111111111","destination_city":"Malabo","amount":25000,"currency":"XAF"}'
```

## Formato de Respuesta

Respuesta exitosa:

```json
{
  "success": true,
  "data": {},
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

Respuesta con paginacion:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "has_more": true,
    "next_offset": 20
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

Respuesta de error:

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Payload invalido",
    "details": {
      "amount": ["amount debe ser mayor a 0"]
    }
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

## Codigos de Error

| Codigo | HTTP | Significado |
| --- | --- | --- |
| `authentication_required` | 401 | Faltan credenciales |
| `invalid_credentials` | 401 | API key/secret invalido o expirado |
| `permission_denied` | 403 | La credencial no tiene permiso o rol valido |
| `validation_error` | 400 | Body o query params invalidos |
| `idempotency_conflict` | 409 | Misma clave de idempotencia con payload distinto |
| `rate_limit_exceeded` | 429 | Se supero el limite de requests |
| `not_found` | 404 | Recurso no encontrado |
| `business_rule_failed` | 400 | Regla de negocio no satisfecha, por ejemplo saldo insuficiente |
| `internal_error` | 500 | Error interno no esperado |

## Endpoints

### Consultar Saldo

```http
GET /api/v1/external/balance
```

Permiso requerido:

```text
balance
```

Ejemplo:

```bash
curl -X GET "http://localhost:3001/api/v1/external/balance" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>"
```

Respuesta para gestor en `production`:

```json
{
  "success": true,
  "data": {
    "role": "gestor",
    "balance": 250000,
    "cash_balance": 50000,
    "currency": "XAF",
    "formatted": "250.000 XAF"
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

Respuesta para cliente en `production`:

```json
{
  "success": true,
  "data": {
    "role": "cliente",
    "balance": 80000,
    "currency": "XAF",
    "formatted": "80.000 XAF"
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

Respuesta para admin en `production`:

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
        "id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
        "name": "Gestor 1",
        "phone": "+240222000111",
        "balance": 250000,
        "cash_balance": 50000
      }
    ]
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

### Consultar Historial

```http
GET /api/v1/external/history
```

Permiso requerido:

```text
history
```

Query params:

| Parametro | Tipo | Default | Limite | Descripcion |
| --- | --- | --- | --- | --- |
| `limit` | integer | `50` | `1..100` | Cantidad maxima de registros |
| `offset` | integer | `0` | `>= 0` | Desplazamiento |
| `status` | string | opcional | max 40 chars | Filtra por estado |
| `created_from` | ISO date-time | opcional | con zona horaria | Fecha inicial |
| `created_to` | ISO date-time | opcional | con zona horaria | Fecha final |

Comportamiento por rol:

| Rol | Datos devueltos |
| --- | --- |
| `admin` / `superadmin` | Historial global de `transfers` |
| `gestor` | Transferencias creadas por ese gestor |
| `cliente` | `wallet_transfers` donde participa como emisor o receptor |

Ejemplo:

```bash
curl -X GET "http://localhost:3001/api/v1/external/history?limit=20&offset=0&status=completed" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>"
```

Ejemplo con fechas:

```bash
curl -X GET "http://localhost:3001/api/v1/external/history?created_from=2026-05-01T00:00:00.000Z&created_to=2026-05-31T23:59:59.999Z" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>"
```

Respuesta:

```json
{
  "success": true,
  "data": [
    {
      "id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
      "amount": 25000,
      "currency": "XAF",
      "status": "completed",
      "created_at": "2026-05-31T18:20:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "next_offset": null
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

### Crear Transferencia de Gestor

```http
POST /api/v1/external/transfer
```

Permisos y rol requeridos:

```text
role_access = gestor
permission transfer = true
```

Headers recomendados:

```http
content-type: application/json
idempotency-key: <UUID_UNICO>
```

Body:

| Campo | Tipo | Requerido | Reglas |
| --- | --- | --- | --- |
| `sender_name` | string | si | 1..120 chars |
| `sender_phone` | string | si | 1..32 chars |
| `sender_document_type` | string | no | max 40 chars |
| `sender_document_number` | string | no | max 80 chars |
| `receiver_name` | string | si | 1..120 chars |
| `receiver_phone` | string | si | 1..32 chars |
| `receiver_document_type` | string | no | max 40 chars |
| `receiver_document_number` | string | no | max 80 chars |
| `destination_city` | string | si | 1..100 chars |
| `destination_country` | string | no | max 80 chars |
| `amount` | number | si | mayor a 0, max 10000000 |
| `currency` | string | no | ISO 4217, default `XAF` |
| `notes` | string | no | max 500 chars |

No se aceptan campos adicionales.

Ejemplo:

```bash
curl -X POST "http://localhost:3001/api/v1/external/transfer" \
  -H "content-type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>" \
  -H "idempotency-key: <UUID_UNICO>" \
  -d '{
    "sender_name": "Cliente origen",
    "sender_phone": "+240000000000",
    "sender_document_type": "dni",
    "sender_document_number": "DOC123",
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "receiver_document_type": "dni",
    "receiver_document_number": "DOC999",
    "destination_city": "Malabo",
    "destination_country": "GQ",
    "amount": 25000,
    "currency": "XAF",
    "notes": "Entrega familiar"
  }'
```

Respuesta:

```http
HTTP/1.1 201 Created
```

```json
{
  "success": true,
  "data": {
    "transfer_id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
    "transfer_code": "ABC123",
    "amount": 25000,
    "currency": "XAF",
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "destination_city": "Malabo",
    "status": "available_for_pickup",
    "created_at": "2026-05-31T18:20:00.000Z"
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

Reglas de negocio:

- el gestor debe tener saldo suficiente;
- la transferencia queda con estado `available_for_pickup`;
- FondosEG calcula comisiones internamente;
- se emite webhook `transfer.created` si hay suscripciones activas.
- si la credencial es `test`, FondosEG valida el payload y devuelve una transferencia simulada con `sandbox: true`.

### Crear Transferencia entre Billeteras

```http
POST /api/v1/external/wallet-transfer
```

Permisos y rol requeridos:

```text
role_access = cliente
permission transfer = true
```

Headers recomendados:

```http
content-type: application/json
idempotency-key: <UUID_UNICO>
```

Body:

| Campo | Tipo | Requerido | Reglas |
| --- | --- | --- | --- |
| `receiver_phone` | string | si | 1..32 chars |
| `receiver_name` | string | si | 1..120 chars |
| `amount` | number | si | mayor a 0, max 10000000 |
| `currency` | string | no | ISO 4217, default `XAF` |
| `notes` | string | no | max 500 chars |

No se aceptan campos adicionales.

Ejemplo:

```bash
curl -X POST "http://localhost:3001/api/v1/external/wallet-transfer" \
  -H "content-type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>" \
  -H "idempotency-key: <UUID_UNICO>" \
  -d '{
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "amount": 5000,
    "currency": "XAF",
    "notes": "Pago interno"
  }'
```

Respuesta:

```http
HTTP/1.1 201 Created
```

```json
{
  "success": true,
  "data": {
    "transfer_id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
    "transfer_type": "wallet",
    "amount": 5000,
    "currency": "XAF",
    "sender_name": "Cliente origen",
    "sender_phone": "+240000000000",
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "status": "completed",
    "created_at": "2026-05-31T18:20:00.000Z",
    "new_balance": 75000
  },
  "request_id": "4b3c3b3d-3f0c-4ed7-bd2b-3b3f0c4ed7bd"
}
```

Reglas de negocio:

- el emisor debe ser cliente;
- el receptor debe existir como cliente valido;
- no se permite transferirse a si mismo;
- el emisor debe tener saldo suficiente;
- la operacion se confirma inmediatamente;
- se emite webhook `wallet_transfer.confirmed` si hay suscripciones activas.
- si la credencial es `test`, FondosEG valida el payload y devuelve una transferencia simulada con `sandbox: true`.

## Webhooks

FondosEG puede enviar eventos HTTP `POST` a una URL configurada por el integrador.

Eventos disponibles:

| Evento | Cuando ocurre |
| --- | --- |
| `transfer.created` | Se crea una transferencia de gestor |
| `transfer.paid_out` | Una transferencia es pagada al destinatario |
| `wallet_transfer.confirmed` | Una transferencia wallet queda confirmada |

Headers enviados:

```http
X-FondosEG-Webhook-Id: <UUID_DEL_EVENTO>
X-FondosEG-Webhook-Event: transfer.created
X-FondosEG-Webhook-Timestamp: 1713878400
X-FondosEG-Webhook-Signature: v1=<FIRMA_HEX>
content-type: application/json
```

El body tiene esta forma:

```json
{
  "id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
  "event": "transfer.created",
  "created_at": "2026-05-31T18:20:00.000Z",
  "data": {}
}
```

### Firma

La firma usa HMAC SHA-256 sobre:

```text
${timestamp}.${rawBody}
```

con el `signing_secret` del webhook.

Ejemplo Node.js:

```ts
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyFondosEGWebhook({
  rawBody,
  timestamp,
  signatureHeader,
  signingSecret,
}: {
  rawBody: string;
  timestamp: string;
  signatureHeader: string;
  signingSecret: string;
}) {
  const expected = createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const received = signatureHeader.replace(/^v1=/, '');

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}
```

Buenas practicas:

- valida la firma antes de procesar el evento;
- rechaza timestamps demasiado antiguos para reducir replay attacks;
- guarda `X-FondosEG-Webhook-Id` y deduplica eventos;
- responde `2xx` solo despues de aceptar el evento;
- procesa tareas lentas en cola interna;
- rota el `signing_secret` si sospechas exposicion.

### Payload `transfer.created`

```json
{
  "id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
  "event": "transfer.created",
  "created_at": "2026-05-31T18:20:00.000Z",
  "data": {
    "transfer_id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
    "transfer_code": "ABC123",
    "amount": 25000,
    "currency": "XAF",
    "status": "available_for_pickup",
    "sender_name": "Cliente origen",
    "sender_phone": "+240000000000",
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "destination_city": "Malabo",
    "destination_country": "GQ",
    "source": "external_api"
  }
}
```

### Payload `transfer.paid_out`

```json
{
  "id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
  "event": "transfer.paid_out",
  "created_at": "2026-05-31T18:25:00.000Z",
  "data": {
    "transfer_id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
    "transfer_code": "ABC123",
    "amount": 25000,
    "currency": "XAF",
    "status": "paid_out",
    "sender_name": "Cliente origen",
    "sender_phone": "+240000000000",
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "destination_city": "Malabo",
    "paid_out_at": "2026-05-31T18:25:00.000Z",
    "paid_out_by": "2d5d48c4-9584-4b3c-9c1b-46e9c12a0000",
    "source": "dashboard"
  }
}
```

### Payload `wallet_transfer.confirmed`

```json
{
  "id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
  "event": "wallet_transfer.confirmed",
  "created_at": "2026-05-31T18:20:00.000Z",
  "data": {
    "transfer_id": "f4a1227e-bf88-4f35-b3de-4ae9f1a4b7bd",
    "amount": 5000,
    "currency": "XAF",
    "status": "confirmed",
    "sender_name": "Cliente origen",
    "sender_phone": "+240000000000",
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "confirmed_at": "2026-05-31T18:20:00.000Z",
    "source": "external_api"
  }
}
```

## SDK TypeScript

El repo incluye un SDK en:

```text
sdk/typescript/fondoseg-sdk
```

Instalacion local desde otro proyecto:

```json
{
  "dependencies": {
    "@fondoseg/sdk": "file:../FondosEG/sdk/typescript/fondoseg-sdk"
  }
}
```

Uso:

```ts
import { FondosEGClient } from '@fondoseg/sdk';

const fondos = new FondosEGClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.FONDOSEG_TEST_API_KEY!,
  apiSecret: process.env.FONDOSEG_TEST_API_SECRET!,
  userAgent: 'mi-app/1.0.0',
});

const balance = await fondos.getBalance();
console.log(balance.data);
```

Crear transferencia:

```ts
const result = await fondos.createTransfer({
  sender_name: 'Cliente origen',
  sender_phone: '+240000000000',
  receiver_name: 'Cliente destino',
  receiver_phone: '+240111111111',
  destination_city: 'Malabo',
  amount: 25000,
  currency: 'XAF',
});

console.log(result.data.transfer_code);
```

Crear transferencia wallet:

```ts
const result = await fondos.createWalletTransfer({
  receiver_name: 'Cliente destino',
  receiver_phone: '+240111111111',
  amount: 5000,
  currency: 'XAF',
});

console.log(result.data.new_balance);
```

Manejo de errores:

```ts
import { FondosEGApiError } from '@fondoseg/sdk';

try {
  await fondos.getBalance();
} catch (error) {
  if (error instanceof FondosEGApiError) {
    console.error(error.status, error.code, error.requestId, error.details);
  }
}
```

## Ejemplos sin SDK

### Node.js con `fetch`

```ts
const response = await fetch('http://localhost:3001/api/v1/external/balance', {
  headers: {
    'x-api-key': process.env.FONDOSEG_API_KEY!,
    'x-api-secret': process.env.FONDOSEG_API_SECRET!,
    accept: 'application/json',
  },
});

const payload = await response.json();

if (!response.ok) {
  throw new Error(`${payload.error?.code}: ${payload.error?.message}`);
}

console.log(payload.data);
```

### PHP con cURL

```php
<?php
$ch = curl_init('http://localhost:3001/api/v1/external/balance');

curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'x-api-key: ' . getenv('FONDOSEG_API_KEY'),
    'x-api-secret: ' . getenv('FONDOSEG_API_SECRET'),
    'accept: application/json',
  ],
]);

$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status >= 400) {
  throw new Exception($body);
}

echo $body;
```

## Seguridad Operativa

Checklist minimo para produccion:

- usa HTTPS/TLS siempre;
- consume la API desde backend, no desde frontend publico;
- guarda `api_secret` en variables de entorno o gestor de secretos;
- no registres secrets en logs;
- rota credenciales periodicamente;
- usa `idempotency-key` en transferencias;
- valida `success === true` antes de usar `data`;
- respeta `retry-after`;
- guarda `request_id` para soporte;
- verifica firmas de webhooks con el raw body exacto;
- deduplica webhooks por `X-FondosEG-Webhook-Id`.

## Pruebas de Integracion

Antes de activar produccion, valida estos casos:

| Caso | Resultado esperado |
| --- | --- |
| Credenciales ausentes | `401 authentication_required` |
| Credenciales invalidas | `401 invalid_credentials` |
| Permiso faltante | `403 permission_denied` |
| JSON invalido | `400 validation_error` |
| Campo requerido ausente | `400 validation_error` |
| Transferencia sin saldo suficiente | `400 business_rule_failed` |
| Reintento con misma idempotency-key y mismo payload | misma respuesta cacheada |
| Reintento con misma idempotency-key y payload distinto | `409 idempotency_conflict` |
| Exceso de requests | `429 rate_limit_exceeded` |
| Credencial `test` crea transferencia | `201` con `sandbox: true`, sin movimiento real |
| Webhook con firma invalida | rechazo en tu backend |
| Webhook duplicado | no duplica efectos |

## Recomendacion por Tipo de Aplicacion

### App de gestores

Usa una credencial con:

```json
{
  "role_access": "gestor",
  "permissions": {
    "balance": true,
    "history": true,
    "transfer": true
  }
}
```

Endpoints:

- `GET /api/v1/external/balance`
- `GET /api/v1/external/history`
- `POST /api/v1/external/transfer`

Webhooks recomendados:

- `transfer.created`
- `transfer.paid_out`

### App de clientes

Usa una credencial con:

```json
{
  "role_access": "cliente",
  "permissions": {
    "balance": true,
    "history": true,
    "transfer": true
  }
}
```

Endpoints:

- `GET /api/v1/external/balance`
- `GET /api/v1/external/history`
- `POST /api/v1/external/wallet-transfer`

Webhooks recomendados:

- `wallet_transfer.confirmed`

## Soporte

Cuando reportes una incidencia, incluye:

- entorno usado;
- endpoint;
- fecha y hora;
- `x-request-id`;
- API key preview, nunca el secret;
- payload sin datos sensibles innecesarios;
- respuesta HTTP completa sin credenciales.

## Changelog

### v1

- Endpoints versionados bajo `/api/v1/external`.
- Autenticacion por `x-api-key` y `x-api-secret`.
- Rate limit por credencial con headers informativos.
- Idempotencia en operaciones monetarias.
- Respuestas estructuradas con `success`, `data`, `error` y `request_id`.
- Historial paginado con filtros de estado y fecha.
- OpenAPI disponible en `/api/docs/openapi.json`.
- Webhooks firmados con HMAC SHA-256.
En `test`, la respuesta conserva la misma forma general pero incluye datos sandbox y `sandbox: true`.
