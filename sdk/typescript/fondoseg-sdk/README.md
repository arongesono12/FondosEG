# FondosEG TypeScript SDK

SDK oficial inicial para consumir la API publica de FondosEG desde otro proyecto TypeScript o JavaScript moderno.

## Lo que incluye

- cliente HTTP tipado para balance, historial y transferencias;
- autenticacion con `x-api-key` y `x-api-secret`;
- idempotencia automatica en operaciones que mueven dinero;
- retries basicos para `429` y errores `5xx`;
- errores tipados;
- utilidades para verificar webhooks firmados.

## Instalacion local

Mientras el paquete vive dentro del repo, puedes consumirlo desde otro proyecto usando una dependencia local:

```json
{
  "dependencies": {
    "@fondoseg/sdk": "file:../FondosEG/sdk/typescript/fondoseg-sdk"
  }
}
```

Luego:

```bash
npm install
```

## Ejemplo rapido

```ts
import { FondosEGClient } from '@fondoseg/sdk';

const fondos = new FondosEGClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.FONDOSEG_API_KEY!,
  apiSecret: process.env.FONDOSEG_API_SECRET!,
  userAgent: 'mi-app/1.0.0',
});

const balance = await fondos.getBalance();
console.log(balance.data.balance);
```

## Crear transferencia

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

## Crear transferencia wallet

```ts
const result = await fondos.createWalletTransfer({
  receiver_name: 'Cliente destino',
  receiver_phone: '+240111111111',
  amount: 5000,
  currency: 'XAF',
});

console.log(result.data.new_balance);
```

## Verificar webhook

```ts
import {
  parseFondosEGWebhookBody,
  parseFondosEGWebhookHeaders,
  verifyFondosEGWebhookSignature,
} from '@fondoseg/sdk';

const rawBody = bodyAsString;
const headers = parseFondosEGWebhookHeaders(request.headers);

const valid = verifyFondosEGWebhookSignature({
  signingSecret: process.env.FONDOSEG_WEBHOOK_SECRET!,
  timestamp: headers.timestamp,
  signature: headers.signature,
  rawBody,
});

if (!valid) {
  throw new Error('Invalid FondosEG webhook signature');
}

const event = parseFondosEGWebhookBody(rawBody);
console.log(event.event, event.data);
```
