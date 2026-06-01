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
    "created_at": "2026-04-06T10:30:00.000Z"
  }
}
```

Notas operativas:

- el backend valida saldo del gestor
- la transferencia se crea como `available_for_pickup`
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

Pendiente recomendado:

- idempotencia activa en endpoints externos de transferencias
- documentacion OpenAPI alineada con estas rutas externas
- ejemplos oficiales para Postman o Insomnia
