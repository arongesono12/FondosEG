# Integracion Revolut para payout links

FondosEG puede activar Revolut como carril alternativo cuando una transferencia de gestor esta pendiente y no hay gestor disponible para pagar en efectivo.

## Flujo implementado

1. El gestor crea la transferencia normal en FondosEG.
2. Un gestor propietario de la transferencia o un administrador abre `Envios > Payout Revolut`.
3. Busca el codigo `TRX-...`.
4. La app crea un payout link en Revolut Business y guarda en `transfers`:
   - `payout_provider = 'revolut'`
   - `payout_reference_id`
   - `payout_url`
   - `payout_state`
   - `payout_request_id`
   - `payout_expires_at`
   - `payout_methods`
   - `payout_raw`

El destinatario reclama el dinero con los metodos habilitados en Revolut. No es retiro por codigo en cajero; es un enlace de cobro digital.

## Variables de entorno

Minimo:

```env
REVOLUT_ENV=sandbox
REVOLUT_ACCOUNT_ID=00000000-0000-0000-0000-000000000000
REVOLUT_ACCESS_TOKEN=oa_sand_...
REVOLUT_PAYOUT_METHODS=revolut,bank_account
REVOLUT_PAYOUT_EXPIRY_PERIOD=P7D
```

Para refrescar token automaticamente en vez de usar `REVOLUT_ACCESS_TOKEN`:

```env
REVOLUT_REFRESH_TOKEN=oa_sand_...
REVOLUT_CLIENT_ID=...
REVOLUT_REDIRECT_DOMAIN=example.com
REVOLUT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

En produccion usa:

```env
REVOLUT_ENV=production
```

O define una base URL explicita:

```env
REVOLUT_API_BASE_URL=https://b2b.revolut.com
```

## Notas operativas

- `card` puede no estar disponible en Sandbox y depende de region. Por eso el valor por defecto es `revolut,bank_account`.
- Los payout links de Revolut solo estan disponibles en regiones soportadas por Revolut Business.
- La clave que empiece por `sk_` no debe usarse como secreto Revolut ni guardarse en el cliente. Si fue expuesta, rotala.
