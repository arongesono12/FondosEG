/**
 * Contenido de la documentación del portal de desarrolladores: endpoints,
 * errores y ejemplos listos para copiar. Vive aparte de la página para que
 * la consola de credenciales no cargue con él y para mantenerlo en un sitio.
 */

export type DocScope = 'balance' | 'transfer' | 'history' | 'payments' | 'properties';

export interface EndpointDoc {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  scope: DocScope;
  title: string;
  description: string;
}

export interface EndpointGroup {
  id: string;
  title: string;
  endpoints: EndpointDoc[];
}

export const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    id: 'wallet',
    title: 'Billetera de la aplicación',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/external/balance',
        scope: 'balance',
        title: 'Consultar saldo',
        description: 'Saldo total, retenido y disponible de la billetera de tu aplicación.',
      },
      {
        method: 'GET',
        path: '/api/v1/external/history',
        scope: 'history',
        title: 'Movimientos',
        description: 'Cobros recibidos y envíos realizados, con dirección y contraparte. Paginado con limit y offset.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Cobros a clientes',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/external/payment-requests',
        scope: 'payments',
        title: 'Crear solicitud de cobro',
        description: 'Devuelve un checkout_url donde el cliente aprueba el pago con su sesión de FondosEG.',
      },
      {
        method: 'GET',
        path: '/api/v1/external/payment-requests/{id}',
        scope: 'payments',
        title: 'Estado de un cobro',
        description: 'pending, paid, cancelled o expired. Verifica aquí antes de confirmar un pedido.',
      },
      {
        method: 'GET',
        path: '/api/v1/external/payment-requests',
        scope: 'payments',
        title: 'Buscar cobros',
        description: 'Lista paginada; filtra por status o por tu referencia (reference).',
      },
      {
        method: 'DELETE',
        path: '/api/v1/external/payment-requests/{id}',
        scope: 'payments',
        title: 'Cancelar cobro',
        description: 'Solo mientras esté pendiente.',
      },
    ],
  },
  {
    id: 'transfers',
    title: 'Envíos a clientes',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/external/wallet-transfer',
        scope: 'transfer',
        title: 'Enviar a una billetera',
        description: 'Mueve saldo de tu aplicación a un cliente FondosEG por su teléfono. Se liquida al instante.',
      },
    ],
  },
  {
    id: 'links',
    title: 'Vínculos de billetera',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/external/wallet-links',
        scope: 'payments',
        title: 'Pedir acceso al saldo',
        description: 'Solo aplicaciones verificadas. Devuelve un authorize_url para que el cliente consienta.',
      },
      {
        method: 'POST',
        path: '/api/v1/external/wallet-links/token',
        scope: 'payments',
        title: 'Canjear el código',
        description: 'Cambia el código de retorno por un token de solo lectura.',
      },
      {
        method: 'GET',
        path: '/api/v1/external/wallet-links/balance',
        scope: 'payments',
        title: 'Saldo del cliente vinculado',
        description: 'Con el header x-wallet-link-token.',
      },
      {
        method: 'DELETE',
        path: '/api/v1/external/wallet-links/{id}',
        scope: 'payments',
        title: 'Revocar vínculo',
        description: 'El cliente también puede revocarlo desde FondosEG.',
      },
    ],
  },
];

export const REQUEST_HEADERS = [
  { name: 'x-api-key', detail: 'Clave pública de la credencial (sk_test_… o sk_live_…).' },
  { name: 'x-api-secret', detail: 'Secreto privado. Solo en tu backend; nunca en apps móviles ni en el navegador.' },
  { name: 'idempotency-key', detail: 'Obligatorio en los POST que mueven dinero. Un UUID por operación; repítelo en los reintentos.' },
  { name: 'content-type', detail: 'application/json cuando la petición lleva cuerpo.' },
] as const;

export const RESPONSE_HEADERS = [
  { name: 'x-request-id', detail: 'Identificador para soporte y conciliación. Guárdalo en tus logs.' },
  { name: 'x-api-environment', detail: 'test o production, según la credencial.' },
  { name: 'x-ratelimit-remaining', detail: 'Peticiones que quedan en la ventana actual.' },
  { name: 'retry-after', detail: 'Segundos de espera tras un 429.' },
] as const;

export const MONEY_RULES = [
  {
    title: 'Importes en XAF, sin decimales',
    detail: 'amount es un número positivo en la divisa de la billetera (XAF). No se convierte divisa: si envías otra, la operación se rechaza.',
  },
  {
    title: 'Teléfonos con prefijo internacional',
    detail: 'Usa +240XXXXXXXXX. FondosEG ignora espacios y guiones y solo acepta coincidencias exactas: nunca envía a un número aproximado.',
  },
  {
    title: 'Saldo disponible, no bruto',
    detail: 'Solo se puede enviar available_balance. Lo retenido por códigos de retiro vivos ya está comprometido.',
  },
  {
    title: 'Liquidación inmediata',
    detail: 'Cobros y envíos se liquidan en una sola transacción: no hay códigos ni pasos pendientes. status: completed es definitivo.',
  },
  {
    title: 'Idempotencia en dinero',
    detail: 'Misma idempotency-key y mismo cuerpo devuelven la respuesta original. Un rechazo de negocio libera la clave para reintentar.',
  },
  {
    title: 'Confirma con la API',
    detail: 'Los parámetros de retorno del checkout son solo una pista: confirma el pedido con GET del cobro o con el webhook firmado.',
  },
] as const;

export const ERROR_DOCS = [
  { status: '400', code: 'validation_error', detail: 'Campos inválidos o faltantes. details indica cada campo.' },
  { status: '401', code: 'invalid_credentials', detail: 'API key o secret ausente, incorrecto, revocado o caducado.' },
  { status: '403', code: 'permission_denied', detail: 'La credencial no tiene el permiso del endpoint.' },
  { status: '409', code: 'idempotency_conflict', detail: 'La misma idempotency-key con otro cuerpo, o una petición aún en curso.' },
  { status: '422', code: 'business_rule_failed', detail: 'Regla de negocio: details.reason indica la causa. Nada se movió.' },
  { status: '429', code: 'rate_limit_exceeded', detail: 'Límite de peticiones superado. Espera retry-after.' },
  { status: '503', code: 'internal_error', detail: 'Resultado incierto. Reintenta con la MISMA idempotency-key.' },
] as const;

export const TRANSFER_REJECTION_REASONS = [
  { reason: 'receiver_not_found', detail: 'No hay un cliente FondosEG con ese teléfono.' },
  { reason: 'receiver_inactive', detail: 'La cuenta del cliente no está activa.' },
  { reason: 'insufficient_funds', detail: 'El saldo disponible de la aplicación no alcanza.' },
  { reason: 'currency_mismatch', detail: 'La divisa no es la de la billetera.' },
  { reason: 'sender_not_allowed', detail: 'La credencial no opera una billetera de cliente activa.' },
] as const;

export const WEBHOOK_EVENTS_DOC = [
  { event: 'payment_request.paid', detail: 'Un cliente pagó un cobro de tu aplicación. El dinero ya está en tu billetera.' },
  { event: 'payment_request.cancelled', detail: 'El cliente rechazó o tu aplicación canceló el cobro.' },
  { event: 'payment_request.payment_failed', detail: 'El cliente intentó pagar sin saldo. El cobro sigue pendiente.' },
  { event: 'wallet_transfer.confirmed', detail: 'Un envío en el que tu billetera es emisora o beneficiaria quedó liquidado.' },
] as const;

export const PRODUCTION_CHECKLIST = [
  'Una aplicación por producto; credenciales de prueba y de producción separadas.',
  'FONDOSEG_API_KEY, FONDOSEG_API_SECRET y FONDOSEG_WEBHOOK_SECRET como secretos del servidor.',
  'idempotency-key guardada con tu operación para reintentar con la misma.',
  'Cada pedido confirmado con GET /payment-requests/{id} o con el webhook verificado.',
  'Reintentos de 429 y 5xx con espera creciente; nunca de 400, 403 ni 422.',
  'x-request-id, código de estado y latencia registrados en cada llamada.',
  'Secret rotado si cambia el equipo o hay sospecha de filtración.',
] as const;

export interface CodeSample {
  id: string;
  label: string;
  code: string;
}

export interface Recipe {
  id: string;
  title: string;
  summary: string;
  samples: CodeSample[];
  response?: string;
}

function curlAuth(apiKey: string): string {
  return `  -H "x-api-key: ${apiKey}" \\\n  -H "x-api-secret: <API_SECRET>"`;
}

/** Ejemplos con la URL del entorno actual y, si hay, la key seleccionada. */
export function buildRecipes(baseUrl: string, apiKey: string = '<API_KEY>'): Recipe[] {
  const auth = curlAuth(apiKey);

  return [
    {
      id: 'balance',
      title: 'Consultar el saldo de tu aplicación',
      summary: 'Antes de enviar, comprueba available_balance: es lo único que se puede mover.',
      samples: [
        {
          id: 'balance-curl',
          label: 'cURL',
          code: `curl "${baseUrl}/api/v1/external/balance" \\\n${auth}`,
        },
        {
          id: 'balance-ts',
          label: 'TypeScript',
          code: `const fondosegHeaders = {
  'x-api-key': process.env.FONDOSEG_API_KEY!,
  'x-api-secret': process.env.FONDOSEG_API_SECRET!,
};

const res = await fetch(\`\${process.env.FONDOSEG_BASE_URL}/api/v1/external/balance\`, {
  headers: fondosegHeaders,
});
const { data } = await res.json();
console.log(data.available_balance, data.currency);`,
        },
      ],
      response: `{
  "success": true,
  "data": {
    "role": "cliente",
    "balance": 150000,
    "available_balance": 150000,
    "reserved_balance": 0,
    "currency": "XAF",
    "formatted": "150.000 XAF",
    "formatted_available": "150.000 XAF"
  },
  "request_id": "6d0c…"
}`,
    },
    {
      id: 'payment-request',
      title: 'Cobrar a un cliente FondosEG',
      summary: 'Crea la solicitud, redirige al cliente al checkout_url y confirma el pago con la API o con el webhook.',
      samples: [
        {
          id: 'payment-request-curl',
          label: 'cURL',
          code: `curl -X POST "${baseUrl}/api/v1/external/payment-requests" \\
  -H "content-type: application/json" \\
${auth} \\
  -d '{
    "orderId": "ALQ-2026-0042",
    "amount": 75000,
    "currency": "XAF",
    "description": "Alquiler octubre · Piso Caracolas",
    "phoneNumber": "+240222123456",
    "returnUrl": "https://tuapp.com/pagos/resultado"
  }'`,
        },
        {
          id: 'payment-request-ts',
          label: 'TypeScript',
          code: `const res = await fetch(\`\${FONDOSEG_BASE_URL}/api/v1/external/payment-requests\`, {
  method: 'POST',
  headers: { ...fondosegHeaders, 'content-type': 'application/json' },
  body: JSON.stringify({
    orderId: order.id,           // tu referencia: repetirla reutiliza el mismo cobro
    amount: order.amount,        // XAF
    phoneNumber: tenant.phone,   // opcional: solo ese cliente podrá pagar
    returnUrl: 'https://tuapp.com/pagos/resultado',
  }),
});
const { data } = await res.json();
return Response.redirect(data.checkout_url, 303);`,
        },
      ],
      response: `{
  "success": true,
  "data": {
    "id": "9b1f…",
    "reference": "ALQ-2026-0042",
    "amount": 75000,
    "currency": "XAF",
    "status": "pending",
    "checkout_url": "${baseUrl}/pay/9b1f…",
    "expires_at": "2026-10-27T10:00:00.000Z"
  }
}`,
    },
    {
      id: 'payment-status',
      title: 'Confirmar el estado de un cobro',
      summary: 'Al volver del checkout llega ?payment=paid&order=…; trátalo solo como pista y verifica aquí.',
      samples: [
        {
          id: 'payment-status-curl',
          label: 'cURL',
          code: `curl "${baseUrl}/api/v1/external/payment-requests/<ID>" \\\n${auth}`,
        },
      ],
    },
    {
      id: 'wallet-transfer',
      title: 'Enviar dinero a la billetera de un cliente',
      summary: 'Desde el saldo de tu aplicación al cliente con ese teléfono. Se liquida al instante y es idempotente.',
      samples: [
        {
          id: 'wallet-transfer-curl',
          label: 'cURL',
          code: `curl -X POST "${baseUrl}/api/v1/external/wallet-transfer" \\
  -H "content-type: application/json" \\
${auth} \\
  -H "idempotency-key: 6f1d2c1e-6c55-4c43-9a0b-7d3f1b2c9e10" \\
  -d '{
    "receiver_phone": "+240222654321",
    "receiver_name": "Propietario Ejemplo",
    "amount": 70000,
    "currency": "XAF",
    "reference": "LIQ-2026-0042",
    "notes": "Liquidación alquiler octubre"
  }'`,
        },
        {
          id: 'wallet-transfer-ts',
          label: 'TypeScript',
          code: `// Guarda la clave con tu operación: si reintentas, usa la MISMA.
const idempotencyKey = payout.idempotencyKey ?? crypto.randomUUID();

const res = await fetch(\`\${FONDOSEG_BASE_URL}/api/v1/external/wallet-transfer\`, {
  method: 'POST',
  headers: {
    ...fondosegHeaders,
    'content-type': 'application/json',
    'idempotency-key': idempotencyKey,
  },
  body: JSON.stringify({
    receiver_phone: owner.phone,
    receiver_name: owner.name,
    amount: payout.amount,
    reference: payout.id,
  }),
});

const body = await res.json();
if (res.status === 422) {
  // Nada se movió: details.reason dice qué corregir.
  throw new Error(body.error.details.reason);
}`,
        },
      ],
      response: `{
  "success": true,
  "data": {
    "transfer_id": "2c7e…",
    "transfer_type": "wallet",
    "reference": "LIQ-2026-0042",
    "amount": 70000,
    "currency": "XAF",
    "sender_name": "CasasEG",
    "receiver_name": "Propietario Ejemplo",
    "receiver_phone": "+240222654321",
    "status": "completed",
    "confirmed_at": "2026-10-26T10:00:00.000Z",
    "new_balance": 5000
  }
}`,
    },
    {
      id: 'history',
      title: 'Conciliar movimientos',
      summary: 'Cada movimiento indica direction (sent o received), la contraparte y el canal.',
      samples: [
        {
          id: 'history-curl',
          label: 'cURL',
          code: `curl "${baseUrl}/api/v1/external/history?limit=20&offset=0&status=completed" \\\n${auth}`,
        },
      ],
      response: `{
  "success": true,
  "data": [
    {
      "transfer_id": "2c7e…",
      "direction": "sent",
      "amount": 70000,
      "currency": "XAF",
      "status": "completed",
      "counterparty_name": "Propietario Ejemplo",
      "counterparty_phone": "+240222654321",
      "channel": "external_api",
      "notes": "Ref: LIQ-2026-0042",
      "created_at": "2026-10-26T10:00:00.000Z"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "has_more": false, "next_offset": null }
}`,
    },
    {
      id: 'wallet-link',
      title: 'Ver el saldo de un cliente (con su permiso)',
      summary: 'Solo aplicaciones verificadas por FondosEG. El token es de solo lectura y el cliente puede revocarlo.',
      samples: [
        {
          id: 'wallet-link-curl',
          label: 'cURL',
          code: `# 1. Pide el vínculo y redirige al cliente a authorize_url
curl -X POST "${baseUrl}/api/v1/external/wallet-links" \\
  -H "content-type: application/json" \\
${auth} \\
  -d '{ "external_user_ref": "user_123", "return_url": "https://tuapp.com/fondoseg/vinculo", "state": "csrf_9f2c1a7b" }'

# 2. Vuelve con ?fondoseg_link=<CODE>&state=…  → canjea el código
curl -X POST "${baseUrl}/api/v1/external/wallet-links/token" \\
  -H "content-type: application/json" \\
${auth} \\
  -d '{ "code": "<CODE>" }'

# 3. Consulta el saldo con el token
curl "${baseUrl}/api/v1/external/wallet-links/balance" \\
${auth} \\
  -H "x-wallet-link-token: <TOKEN>"`,
        },
      ],
    },
  ];
}

export const WEBHOOK_VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from 'node:crypto';

export async function handleFondosEGWebhook(request: Request) {
  const rawBody = await request.text();               // el cuerpo SIN parsear
  const timestamp = request.headers.get('x-fondoseg-webhook-timestamp') ?? '';
  const signature = (request.headers.get('x-fondoseg-webhook-signature') ?? '').replace(/^v1=/, '');

  // Rechaza eventos de más de 5 minutos (repetición).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return new Response(null, { status: 400 });

  const expected = createHmac('sha256', process.env.FONDOSEG_WEBHOOK_SECRET!)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex');

  const valid = expected.length === signature.length
    && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) return new Response(null, { status: 401 });

  const event = JSON.parse(rawBody);
  // event.id es único: ignora los que ya procesaste (FondosEG reintenta).
  if (event.event === 'payment_request.paid') {
    await markOrderPaid(event.data.reference, event.data.payment_request_id);
  }
  return new Response(null, { status: 204 });
}`;

export const WEBHOOK_PAYLOAD_SAMPLE = `POST https://tuapp.com/webhooks/fondoseg
X-FondosEG-Webhook-Id: 0f6e…
X-FondosEG-Webhook-Event: payment_request.paid
X-FondosEG-Webhook-Timestamp: 1761472800
X-FondosEG-Webhook-Signature: v1=5c1b…

{
  "id": "0f6e…",
  "event": "payment_request.paid",
  "created_at": "2026-10-26T10:00:00.000Z",
  "data": {
    "payment_request_id": "9b1f…",
    "reference": "ALQ-2026-0042",
    "amount": 75000,
    "currency": "XAF",
    "status": "paid",
    "wallet_transfer_id": "7a3d…",
    "paid_at": "2026-10-26T10:00:00.000Z"
  }
}`;

export const CASASEG_FLOW = [
  {
    title: 'Crea la aplicación «CasasEG»',
    detail: 'En Aplicaciones → Nueva aplicación. FondosEG le abre una billetera propia: no hace falta teléfono ni rol.',
  },
  {
    title: 'Emite una credencial de prueba y otra de producción',
    detail: 'Permisos: saldo, envíos, historial y cobros. Guarda key y secret como secretos de las Edge Functions de CasasEG.',
  },
  {
    title: 'Registra el webhook',
    detail: 'URL de rental-payment-callback con payment_request.paid, payment_request.cancelled y wallet_transfer.confirmed.',
  },
  {
    title: 'El inquilino paga el alquiler',
    detail: 'CasasEG crea un cobro con orderId = id del pago y redirige al checkout_url. El importe entra en la billetera de CasasEG.',
  },
  {
    title: 'CasasEG liquida al propietario',
    detail: 'Al recibir payment_request.paid, envía con wallet-transfer el importe menos su comisión al teléfono del propietario.',
  },
  {
    title: 'Concilia',
    detail: 'Usa history y el reference de cada envío para cuadrar cobros, comisiones y liquidaciones.',
  },
] as const;
