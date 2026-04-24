# Supabase Edge Functions

## Funciones incluidas

- `fondoseg-proxy`
- `fondoseg-balance`
- `fondoseg-history`
- `fondoseg-transfer`
- `fondoseg-wallet-transfer`
- `fondoseg-health`

La funcion `fondoseg-proxy` sirve como base generica.

Las otras funciones son rutas especificas para cada caso de uso.

## Variables necesarias

Para desarrollo local crea:

- `supabase/functions/.env.local`
- puedes partir de `supabase/functions/.env.local.example`

Contenido sugerido:

```env
FONDOSEG_API_BASE_URL=https://tu-dominio.com
FONDOSEG_API_KEY=tu_api_key_externa
FONDOSEG_API_SECRET=tu_api_secret_externa
```

Nota:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

normalmente son inyectadas por Supabase en produccion. En local puedes tenerlas disponibles al correr Supabase local o definirlas si tu flujo las necesita.

## Crear funciones

Si quieres recrearlas con CLI:

```bash
supabase functions new fondoseg-proxy
supabase functions new fondoseg-balance
supabase functions new fondoseg-history
supabase functions new fondoseg-transfer
supabase functions new fondoseg-wallet-transfer
supabase functions new fondoseg-health
```

## Probar en local

```bash
supabase functions serve --env-file supabase/functions/.env.local
```

Prueba de salud del proxy:

```bash
curl -i http://127.0.0.1:54321/functions/v1/fondoseg-proxy
```

Prueba del saldo:

```bash
curl -i http://127.0.0.1:54321/functions/v1/fondoseg-balance
```

Prueba de salud completa:

```bash
curl -i http://127.0.0.1:54321/functions/v1/fondoseg-health
```

Prueba del historial:

```bash
curl -i "http://127.0.0.1:54321/functions/v1/fondoseg-history?limit=20&offset=0"
```

Prueba de transferencia de gestor:

```bash
curl -i http://127.0.0.1:54321/functions/v1/fondoseg-transfer ^
  -H "Content-Type: application/json" ^
  -d "{\"sender_name\":\"Juan\",\"sender_phone\":\"222000111\",\"receiver_name\":\"Maria\",\"receiver_phone\":\"222999888\",\"destination_city\":\"Malabo\",\"amount\":50000,\"currency\":\"XAF\"}"
```

Prueba de transferencia entre billeteras:

```bash
curl -i http://127.0.0.1:54321/functions/v1/fondoseg-wallet-transfer ^
  -H "Content-Type: application/json" ^
  -d "{\"receiver_phone\":\"222999888\",\"receiver_name\":\"Maria\",\"amount\":10000,\"currency\":\"XAF\"}"
```

Prueba POST del proxy generico:

```bash
curl -i http://127.0.0.1:54321/functions/v1/fondoseg-proxy ^
  -H "Content-Type: application/json" ^
  -d "{\"path\":\"/api/external/balance\",\"method\":\"GET\"}"
```

## Configurar secretos remotos

```bash
supabase secrets set FONDOSEG_API_BASE_URL=https://fondoseg.com
supabase secrets set FONDOSEG_API_KEY=tu_api_key_externa
supabase secrets set FONDOSEG_API_SECRET=tu_api_secret_externa
```

O desde archivo:

```bash
supabase secrets set --env-file supabase/functions/.env.local
```

## Desplegar

```bash
supabase functions deploy fondoseg-proxy
supabase functions deploy fondoseg-balance
supabase functions deploy fondoseg-history
supabase functions deploy fondoseg-transfer
supabase functions deploy fondoseg-wallet-transfer
supabase functions deploy fondoseg-health
```

Si debe ser publica sin verificar JWT:

```bash
supabase functions deploy fondoseg-proxy --no-verify-jwt
supabase functions deploy fondoseg-balance --no-verify-jwt
supabase functions deploy fondoseg-history --no-verify-jwt
supabase functions deploy fondoseg-transfer --no-verify-jwt
supabase functions deploy fondoseg-wallet-transfer --no-verify-jwt
supabase functions deploy fondoseg-health --no-verify-jwt
```
