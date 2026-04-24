# Guia de Integracion FondosEG Public API

## Base URL

- Desarrollo local: `http://localhost:3001`
- Produccion: usar el dominio configurado en `NEXT_PUBLIC_APP_URL`

## Portal de Desarrolladores

Acceso recomendado para integradores:

- portal publico: `/developers-portal`
- registro de desarrolladores: `/developers-portal/register`
- login de desarrolladores: `/developers-portal/login`
- consola autenticada de APIs: `/developers`

Flujo esperado:

1. El desarrollador entra al portal publico.
2. Crea su cuenta o inicia sesion.
3. FondosEG lo redirige a la consola `/developers`.
4. Desde ahi genera credenciales, copia OpenAPI y configura webhooks.

## Autenticacion

Cada request externo debe enviar:

```http
x-api-key: sk_...
x-api-secret: ...
```

Las credenciales se crean desde `/developers`. El `api_secret` completo solo se muestra una vez al crear la credencial.
Si necesitas regenerarlo, usa la opcion de rotacion desde el portal de desarrolladores.

## Idempotencia

En operaciones que mueven dinero, envia una clave unica por intento logico:

```http
idempotency-key: 9a3e8e98-2d5d-48c4-9584-0d2b5b46e9c1
```

Si repites el request con el mismo payload, FondosEG devuelve la respuesta cacheada. Si repites la misma clave con otro payload, devuelve `409 idempotency_conflict`.

## Formato de Respuesta Exitosa

```json
{
  "success": true,
  "data": {},
  "request_id": "uuid"
}
```

## Formato de Error

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Payload invalido",
    "details": {}
  },
  "request_id": "uuid"
}
```

Codigos principales:

- `invalid_credentials`
- `rate_limit_exceeded`
- `permission_denied`
- `validation_error`
- `idempotency_conflict`
- `not_found`
- `business_rule_failed`
- `internal_error`

## Endpoints

### Consultar saldo

```bash
curl -X GET "http://localhost:3001/api/external/balance" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>"
```

### Crear transferencia de gestor

```bash
curl -X POST "http://localhost:3001/api/external/transfer" \
  -H "content-type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>" \
  -H "idempotency-key: <UUID_UNICO>" \
  -d '{
    "sender_name": "Cliente origen",
    "sender_phone": "+240000000000",
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "destination_city": "Malabo",
    "destination_country": "GQ",
    "amount": 25000,
    "currency": "XAF"
  }'
```

### Crear transferencia entre billeteras

```bash
curl -X POST "http://localhost:3001/api/external/wallet-transfer" \
  -H "content-type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>" \
  -H "idempotency-key: <UUID_UNICO>" \
  -d '{
    "receiver_name": "Cliente destino",
    "receiver_phone": "+240111111111",
    "amount": 5000,
    "currency": "XAF"
  }'
```

### Consultar historial

```bash
curl -X GET "http://localhost:3001/api/external/history?limit=20&offset=0" \
  -H "x-api-key: <API_KEY>" \
  -H "x-api-secret: <API_SECRET>"
```

## Contrato OpenAPI

Disponible en:

```text
/api/docs/openapi.json
```

Ese archivo puede usarse para generar un cliente TypeScript, validar payloads o documentar la API con Swagger UI/Redoc.

## SDK TypeScript

El repo ya incluye un SDK inicial en:

```text
sdk/typescript/fondoseg-sdk
```

Incluye:

- cliente tipado para `balance`, `history`, `transfer` y `wallet-transfer`;
- retries basicos para `429` y `5xx`;
- idempotencia automatica en operaciones monetarias;
- errores tipados;
- utilidades para verificar webhooks firmados.

Uso rapido:

```ts
import { FondosEGClient } from '@fondoseg/sdk';

const client = new FondosEGClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.FONDOSEG_API_KEY!,
  apiSecret: process.env.FONDOSEG_API_SECRET!,
});

const balance = await client.getBalance();
```

## Webhooks Firmados

FondosEG puede enviar eventos HTTP `POST` a los endpoints registrados por cada integrador. Los eventos disponibles hoy son:

- `transfer.created`
- `transfer.paid_out`
- `wallet_transfer.confirmed`

Las suscripciones se gestionan desde el portal de desarrolladores y las rutas autenticadas:

- `GET /api/webhooks`
- `POST /api/webhooks`
- `PATCH /api/webhooks/{id}`
- `DELETE /api/webhooks/{id}`
- `POST /api/webhooks/{id}/rotate`

Cada entrega incluye estos headers:

```http
X-FondosEG-Webhook-Id: <UUID_DEL_EVENTO>
X-FondosEG-Webhook-Event: transfer.created
X-FondosEG-Webhook-Timestamp: 1713878400
X-FondosEG-Webhook-Signature: v1=<FIRMA_HEX>
```

La firma se calcula con `HMAC SHA-256` sobre:

```text
${timestamp}.${rawBody}
```

usando el `signing_secret` del webhook. Ese secreto completo solo se muestra una vez al crear o rotar la suscripcion.

Ejemplo de verificacion en Node.js:

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

  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}
```

Recomendaciones operativas:

- rechazar timestamps demasiado antiguos para reducir replay attacks;
- responder `2xx` solo cuando el evento ya fue aceptado por tu sistema;
- guardar `X-FondosEG-Webhook-Id` para deduplicar reintentos;
- rotar el `signing_secret` cuando sospeches exposición.

Variables de entorno recomendadas:

- `WEBHOOK_ENCRYPTION_KEY`: clave de 32 bytes para cifrar el `signing_secret` en base de datos.
- `WEBHOOK_WORKER_SECRET`: bearer token para invocar `POST /api/webhooks/process` desde cron o un worker.

## Estado Actual de Produccion

- API keys con secret hasheado y rotacion.
- Rate limit por credencial.
- `request_id` en todas las respuestas externas.
- Idempotencia en operaciones de dinero.
- Logs de actividad por credencial.
- Transferencia wallet externa ejecutada como operacion atomica en SQL.
- Webhooks firmados con HMAC SHA-256, cola de entregas y reintentos.
