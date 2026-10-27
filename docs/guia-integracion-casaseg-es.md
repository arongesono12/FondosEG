# Guía: integrar CasasEG (u otra app) con FondosEG

Cómo cobrar el alquiler al inquilino desde su billetera FondosEG y liquidar
automáticamente al propietario, usando las APIs de integradores.

## 1. El modelo: una aplicación, una billetera

En FondosEG cada producto que se integra es una **aplicación**. Al crearla,
FondosEG le abre su **propia billetera de cliente**. No hay que elegir un rol ni
indicar el teléfono de ninguna cuenta.

```
Inquilino (cliente FondosEG)
   │  paga en el checkout de FondosEG
   ▼
Billetera de la aplicación «CasasEG»  ── la comisión de CasasEG se queda aquí
   │  wallet-transfer
   ▼
Propietario (cliente FondosEG)
```

- Los **cobros** (`payment-requests`) se abonan en la billetera de la aplicación.
- Los **envíos** (`wallet-transfer`) salen de esa billetera.
- Los **webhooks** de la aplicación reciben solo los eventos de esa billetera.
- La billetera de la aplicación no tiene teléfono ni inicio de sesión. Solo
  la mueven sus credenciales. Recibe dinero únicamente por los cobros.

## 2. Preparar FondosEG (una vez)

1. Aplica `supabase/migrations/20261026_api_applications.sql` en el SQL Editor
   de Supabase (proyecto de FondosEG). Es idempotente y:
   - crea `api_applications`,
   - agrupa las credenciales existentes en aplicaciones (conservan su billetera),
   - permite que la billetera de una aplicación reciba cobros.
2. Despliega FondosEG.

## 3. Dar de alta CasasEG en el portal

Entra como **superadmin** en `Portal de desarrolladores → Aplicaciones`.

> Si CasasEG ya tenía credenciales emitidas con el teléfono de su cuenta, tras la
> migración aparece una aplicación «CasasEG» marcada como *Aplicación anterior*.
> Esa aplicación sigue operando la billetera de esa cuenta, con su saldo. **Sigue
> usándola** mientras esa billetera tenga fondos: la billetera de una aplicación
> nueva empieza en 0 y no puede recibir transferencias por teléfono.

Para una integración nueva:

1. **Nueva aplicación** → nombre `CasasEG`. Es el nombre que verá el inquilino al pagar.
   Creada por el superadmin, queda **Verificada**, lo que hace falta para pedir
   vínculos de billetera.
2. **Nueva credencial** → *Prueba*. Copia la key y el secret: el secret solo se ve una vez.
3. Cuando todo funcione en prueba: **Nueva credencial** → *Producción*.

Permisos recomendados (principio de mínimo privilegio, dos credenciales):

| Credencial | Permisos | Variables en CasasEG |
|---|---|---|
| Cobros | `payments` | `FONDOSEG_PAYMENTS_API_KEY`, `FONDOSEG_PAYMENTS_API_SECRET` |
| Liquidaciones | `balance`, `transfer`, `history` | `FONDOSEG_PAYOUT_API_KEY`, `FONDOSEG_PAYOUT_API_SECRET` |

Con una sola credencial con los cuatro permisos también funciona. CasasEG
usa `FONDOSEG_API_KEY` y `FONDOSEG_API_SECRET` cuando faltan las específicas.

## 4. Configurar CasasEG

Secretos de las Edge Functions de CasasEG (proyecto Supabase de CasasEG):

```bash
supabase secrets set \
  FONDOSEG_API_BASE_URL=https://fondoseg.com \
  FONDOSEG_PAYMENTS_API_KEY=sk_live_... \
  FONDOSEG_PAYMENTS_API_SECRET=... \
  FONDOSEG_PAYOUT_API_KEY=sk_live_... \
  FONDOSEG_PAYOUT_API_SECRET=... \
  FONDOSEG_WEBHOOK_SECRET=... \
  FONDOSEG_PAYOUT_FEE_BPS=500
```

- `FONDOSEG_WEBHOOK_SECRET`: el secreto de firma del paso 5.
- `FONDOSEG_PAYOUT_FEE_BPS` / `FONDOSEG_PAYOUT_FIXED_FEE`: la comisión de CasasEG
  (500 puntos básicos = 5 %). Se queda en la billetera de la aplicación.
- `FONDOSEG_LINK_TOKEN_KEY`: clave propia de CasasEG (32 bytes en base64) para
  cifrar los tokens de vínculo. No la da FondosEG.

## 5. Registrar el webhook

En la aplicación CasasEG → **Webhooks → Añadir**:

- URL: `https://<proyecto-casaseg>.supabase.co/functions/v1/rental-payment-callback`
- Eventos: `payment_request.paid`, `payment_request.cancelled`,
  `payment_request.payment_failed`, `wallet_transfer.confirmed`

Guarda el secreto de firma como `FONDOSEG_WEBHOOK_SECRET`. FondosEG firma cada
evento con `X-FondosEG-Webhook-Signature: v1=HMAC_SHA256(secret, "<timestamp>.<cuerpo>")`.
`rental-payment-callback` ya verifica esa firma.

## 6. El flujo, paso a paso

### 6.1 El inquilino paga (`rental-payment-initiate`)

```http
POST /api/v1/external/payment-requests
x-api-key: <FONDOSEG_PAYMENTS_API_KEY>
x-api-secret: <FONDOSEG_PAYMENTS_API_SECRET>
content-type: application/json

{
  "orderId": "<id del pago en CasasEG>",
  "paymentReference": "CEG-RENT-20261026-0001",
  "amount": 75000,
  "currency": "XAF",
  "description": "Alquiler octubre",
  "phoneNumber": "+240222123456",
  "returnUrl": "https://casaseg.com/pagos"
}
```

- Devuelve `checkout_url`: redirige al inquilino allí. Paga con su sesión de FondosEG.
- Repetir el mismo `orderId` devuelve el mismo cobro (no se duplica).
- `phoneNumber` es opcional: si se indica, solo ese cliente puede pagar.

### 6.2 Confirmar el pago (`rental-payment-callback`)

- Llega `payment_request.paid` con `data.reference` = tu `orderId`.
- El dinero **ya está** en la billetera de CasasEG.
- Los parámetros `?payment=paid&order=…` del `returnUrl` son solo una pista:
  la verdad es el webhook firmado o `GET /api/v1/external/payment-requests/{id}`.

### 6.3 Liquidar al propietario (`fondoseg-owner-payout`)

```http
POST /api/v1/external/wallet-transfer
x-api-key: <FONDOSEG_PAYOUT_API_KEY>
x-api-secret: <FONDOSEG_PAYOUT_API_SECRET>
idempotency-key: <id de la liquidación en CasasEG>
content-type: application/json

{
  "receiver_phone": "+240222654321",
  "receiver_name": "Propietario",
  "amount": 71250,
  "currency": "XAF",
  "reference": "LIQ-20261026-0001",
  "notes": "Alquiler CasasEG CEG-RENT-20261026-0001"
}
```

Reglas (las mismas que un envío desde la app de FondosEG):

- El propietario debe ser **cliente FondosEG activo** con ese teléfono.
  Se aceptan espacios y guiones, pero solo una coincidencia exacta.
- Solo se envía el **saldo disponible** (`GET /balance → available_balance`).
- Se liquida al instante (`status: completed`).
- Respuestas:
  - `201`: hecho.
  - `422` con `error.details.reason`: `receiver_not_found`, `receiver_inactive`,
    `insufficient_funds` o `currency_mismatch`. **No se movió dinero.** Corrige y
    reintenta con la misma `idempotency-key`.
  - `503`: resultado incierto. Reintenta con la **misma** `idempotency-key`;
    FondosEG devolverá la respuesta original si ya se hizo.
  - `409`: la misma clave con otro cuerpo, o una petición aún en curso.

### 6.4 Conciliar

```http
GET /api/v1/external/history?limit=100&offset=0
```

Cada movimiento trae `direction` (`received` = cobro, `sent` = liquidación),
`counterparty_name`, `channel` (`payment_request` o `external_api`) y `notes`,
donde aparece `Ref: <reference>`.

## 7. Vínculos de billetera (opcional)

Para mostrar al propietario su saldo FondosEG dentro de CasasEG (con su permiso):

1. `POST /api/v1/external/wallet-links` → `authorize_url`. Redirige al cliente.
2. Vuelve con `?fondoseg_link=<code>&state=…` → `POST /api/v1/external/wallet-links/token`.
3. `GET /api/v1/external/wallet-links/balance` con `x-wallet-link-token`.

Solo funciona con aplicaciones **verificadas** (creadas por el superadmin).

## 8. Ajustes recomendados en CasasEG

- `supabase/functions/_shared/fondoseg-owner-payout.ts`: comparar el importe con
  `data.available_balance` (hoy usa `total_balance ?? balance`). FondosEG ya
  rechaza el envío con `422 insufficient_funds` si no alcanza, pero así se
  evita la llamada.
- Enviar `reference: payout_reference` en el cuerpo del `wallet-transfer`, para
  conciliar sin parsear `notes`.
- Tratar `422` como error definitivo de negocio (mostrar `details.reason`) y
  `503` como reintento con la misma clave.

## 9. Lista de pruebas

1. Credencial de **prueba**: `/balance`, `/payment-requests` y `/wallet-transfer`
   responden con datos simulados (`sandbox: true`).
2. Credencial de **producción** con un importe pequeño:
   cobro → webhook `payment_request.paid` → liquidación → `wallet_transfer.confirmed`.
3. Liquidación a un teléfono inexistente → `422 receiver_not_found` y nada se mueve.
4. Reintento con la misma `idempotency-key` → misma respuesta, sin segundo envío.
5. Webhook con firma alterada → CasasEG lo rechaza.
