import { publicApiDocumentationResponse } from '@/lib/server/public-api';

const baseErrorSchema = {
  type: 'object',
  required: ['success', 'error', 'request_id'],
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          enum: [
            'authentication_required',
            'invalid_credentials',
            'rate_limit_exceeded',
            'permission_denied',
            'validation_error',
            'idempotency_conflict',
            'not_found',
            'business_rule_failed',
            'internal_error',
          ],
        },
        message: { type: 'string' },
        details: {},
      },
    },
    request_id: { type: 'string', format: 'uuid' },
  },
};

const publicApiResponseHeaders = {
  'x-request-id': {
    description: 'Identificador de trazabilidad de la solicitud.',
    schema: { type: 'string', format: 'uuid' },
  },
  'x-api-version': {
    description: 'Version estable de la API publica.',
    schema: { type: 'string', example: 'v1' },
  },
  'x-api-environment': {
    description: 'Entorno de la credencial autenticada.',
    schema: { type: 'string', enum: ['test', 'production'] },
  },
  'x-ratelimit-limit': {
    description: 'Limite de requests para la ventana actual.',
    schema: { type: 'integer' },
  },
  'x-ratelimit-remaining': {
    description: 'Requests restantes en la ventana actual.',
    schema: { type: 'integer' },
  },
  'x-ratelimit-reset': {
    description: 'Fecha ISO en que reinicia la ventana de rate limit.',
    schema: { type: 'string', format: 'date-time' },
  },
};

export async function GET() {
  return publicApiDocumentationResponse({
    openapi: '3.1.0',
    info: {
      title: 'FondosEG Public API',
      version: 'v1',
      summary: 'API publica para saldos, transferencias e historial de FondosEG.',
      description:
        'Usa credenciales emitidas desde el portal de desarrolladores. La version estable actual vive bajo /api/v1/external. Cada credencial pertenece al entorno test o production. Las claves test simulan saldos y transferencias sin mover dinero real; las production operan sobre datos reales. Las rutas historicas /api/external siguen disponibles por compatibilidad. Las operaciones que mueven dinero aceptan el header idempotency-key para evitar duplicados. FondosEG tambien soporta webhooks firmados con HMAC SHA-256 en el formato timestamp.body.',
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL || 'https://fondoseg.com',
        description: 'Produccion',
      },
      {
        url: 'http://localhost:3001',
        description: 'Desarrollo local',
      },
    ],
    security: [{ ApiKeyAuth: [], ApiSecretAuth: [] }],
    tags: [
      { name: 'Balance', description: 'Consulta de saldos por rol.' },
      { name: 'Transfers', description: 'Creacion de movimientos FondosEG.' },
      { name: 'History', description: 'Consulta de operaciones.' },
      { name: 'Properties', description: 'Consulta de propiedades y contratos de alquiler.' },
      { name: 'Payments', description: 'Pagos de alquiler procesados con la app de pagos externa.' },
      { name: 'Webhooks', description: 'Eventos salientes firmados para integraciones.' },
    ],
    paths: {
      '/api/v1/external/balance': {
        get: {
          tags: ['Balance'],
          operationId: 'getExternalBalance',
          summary: 'Consultar saldo disponible',
          responses: {
            '200': {
              description: 'Saldo consultado correctamente.',
              headers: publicApiResponseHeaders,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BalanceResponse' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/v1/external/transfer': {
        post: {
          tags: ['Transfers'],
          operationId: 'createAgentTransfer',
          summary: 'Crear transferencia de gestor',
          parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateAgentTransferRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Transferencia creada correctamente.',
              headers: publicApiResponseHeaders,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateAgentTransferResponse' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '409': { $ref: '#/components/responses/IdempotencyConflict' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/v1/external/wallet-transfer': {
        post: {
          tags: ['Transfers'],
          operationId: 'createWalletTransfer',
          summary: 'Crear transferencia entre billeteras',
          parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateWalletTransferRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Transferencia de billetera creada correctamente.',
              headers: publicApiResponseHeaders,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateWalletTransferResponse' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { $ref: '#/components/responses/IdempotencyConflict' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/v1/external/history': {
        get: {
          tags: ['History'],
          operationId: 'getExternalHistory',
          summary: 'Consultar historial de operaciones',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filtra por estado de la operacion.',
            },
            {
              name: 'created_from',
              in: 'query',
              schema: { type: 'string', format: 'date-time' },
              description: 'Fecha inicial ISO 8601 con zona horaria.',
            },
            {
              name: 'created_to',
              in: 'query',
              schema: { type: 'string', format: 'date-time' },
              description: 'Fecha final ISO 8601 con zona horaria.',
            },
          ],
          responses: {
            '200': {
              description: 'Historial consultado correctamente.',
              headers: publicApiResponseHeaders,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HistoryResponse' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/v1/external/properties': {
        get: {
          tags: ['Properties'],
          operationId: 'listExternalProperties',
          summary: 'Listar propiedades',
          description: 'Requiere el scope `properties`. Devuelve las propiedades visibles para la credencial.',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['available', 'rented', 'inactive'] },
              description: 'Filtra por estado de la propiedad.',
            },
          ],
          responses: {
            '200': {
              description: 'Propiedades consultadas correctamente.',
              headers: publicApiResponseHeaders,
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/HistoryResponse' } },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/v1/external/rentals': {
        get: {
          tags: ['Properties'],
          operationId: 'listExternalRentals',
          summary: 'Listar contratos de alquiler',
          description: 'Requiere el scope `properties`. Lista los alquileres asociados a la credencial.',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['active', 'ended', 'cancelled'] },
              description: 'Filtra por estado del alquiler.',
            },
            {
              name: 'property_id',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
              description: 'Filtra por propiedad.',
            },
          ],
          responses: {
            '200': {
              description: 'Alquileres consultados correctamente.',
              headers: publicApiResponseHeaders,
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/HistoryResponse' } },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/v1/external/rental-payments': {
        get: {
          tags: ['Payments'],
          operationId: 'listRentalPayments',
          summary: 'Listar pagos de alquiler',
          description: 'Requiere el scope `payments`. Lista los pagos visibles para la credencial.',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'] },
            },
            { name: 'rental_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Pagos consultados correctamente.',
              headers: publicApiResponseHeaders,
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/HistoryResponse' } },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Payments'],
          operationId: 'createRentalPayment',
          summary: 'Iniciar un pago de alquiler',
          description:
            'Requiere el scope `payments`. Crea un pago de alquiler y, si la app de pagos esta configurada, genera el cobro externo. Si no, el pago queda en estado `pending`.',
          parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateRentalPaymentRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Pago de alquiler creado correctamente.',
              headers: publicApiResponseHeaders,
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CreateRentalPaymentResponse' } },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { $ref: '#/components/responses/IdempotencyConflict' },
            '429': { $ref: '#/components/responses/RateLimited' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
    },
    webhooks: {
      transferCreated: {
        post: {
          tags: ['Webhooks'],
          summary: 'Evento emitido cuando una transferencia de gestor queda creada.',
          parameters: [
            { $ref: '#/components/parameters/WebhookIdHeader' },
            { $ref: '#/components/parameters/WebhookEventHeader' },
            { $ref: '#/components/parameters/WebhookTimestampHeader' },
            { $ref: '#/components/parameters/WebhookSignatureHeader' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TransferCreatedWebhook' },
              },
            },
          },
          responses: {
            '200': { description: 'El receptor acepto el evento.' },
          },
        },
      },
      transferPaidOut: {
        post: {
          tags: ['Webhooks'],
          summary: 'Evento emitido cuando una transferencia es pagada al destinatario.',
          parameters: [
            { $ref: '#/components/parameters/WebhookIdHeader' },
            { $ref: '#/components/parameters/WebhookEventHeader' },
            { $ref: '#/components/parameters/WebhookTimestampHeader' },
            { $ref: '#/components/parameters/WebhookSignatureHeader' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TransferPaidOutWebhook' },
              },
            },
          },
          responses: {
            '200': { description: 'El receptor acepto el evento.' },
          },
        },
      },
      walletTransferConfirmed: {
        post: {
          tags: ['Webhooks'],
          summary: 'Evento emitido cuando una transferencia entre billeteras queda confirmada.',
          parameters: [
            { $ref: '#/components/parameters/WebhookIdHeader' },
            { $ref: '#/components/parameters/WebhookEventHeader' },
            { $ref: '#/components/parameters/WebhookTimestampHeader' },
            { $ref: '#/components/parameters/WebhookSignatureHeader' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WalletTransferConfirmedWebhook' },
              },
            },
          },
          responses: {
            '200': { description: 'El receptor acepto el evento.' },
          },
        },
      },
      rentalPaymentUpdated: {
        post: {
          tags: ['Webhooks'],
          summary:
            'Evento emitido cuando cambia el estado de un pago de alquiler (created, processing, paid, failed, refunded, cancelled).',
          parameters: [
            { $ref: '#/components/parameters/WebhookIdHeader' },
            { $ref: '#/components/parameters/WebhookEventHeader' },
            { $ref: '#/components/parameters/WebhookTimestampHeader' },
            { $ref: '#/components/parameters/WebhookSignatureHeader' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RentalPaymentWebhook' },
              },
            },
          },
          responses: {
            '200': { description: 'El receptor acepto el evento.' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
        ApiSecretAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-secret',
        },
      },
      parameters: {
        IdempotencyKey: {
          name: 'idempotency-key',
          in: 'header',
          required: false,
          schema: { type: 'string', minLength: 8 },
          description: 'Clave unica por operacion para evitar duplicados al reintentar requests.',
        },
        WebhookIdHeader: {
          name: 'X-FondosEG-Webhook-Id',
          in: 'header',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Identificador unico del evento enviado por FondosEG.',
        },
        WebhookEventHeader: {
          name: 'X-FondosEG-Webhook-Event',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            enum: [
              'transfer.created',
              'transfer.paid_out',
              'wallet_transfer.confirmed',
              'rental_payment.created',
              'rental_payment.processing',
              'rental_payment.paid',
              'rental_payment.failed',
              'rental_payment.refunded',
              'rental_payment.cancelled',
            ],
          },
          description: 'Tipo de evento emitido por FondosEG.',
        },
        WebhookTimestampHeader: {
          name: 'X-FondosEG-Webhook-Timestamp',
          in: 'header',
          required: true,
          schema: { type: 'string', example: '1713878400' },
          description: 'Timestamp UNIX en segundos usado para firmar el payload.',
        },
        WebhookSignatureHeader: {
          name: 'X-FondosEG-Webhook-Signature',
          in: 'header',
          required: true,
          schema: { type: 'string', example: 'v1=7f2c9a...' },
          description:
            'Firma HMAC SHA-256 en formato v1=<hex>. Se calcula sobre `${timestamp}.${rawBody}` usando el webhook signing secret.',
        },
      },
      responses: {
        BadRequest: {
          description: 'Payload invalido o regla de negocio fallida.',
          headers: publicApiResponseHeaders,
          content: { 'application/json': { schema: baseErrorSchema } },
        },
        Unauthorized: {
          description: 'Credenciales ausentes o invalidas.',
          headers: publicApiResponseHeaders,
          content: { 'application/json': { schema: baseErrorSchema } },
        },
        Forbidden: {
          description: 'La credencial no tiene permiso para esta operacion.',
          headers: publicApiResponseHeaders,
          content: { 'application/json': { schema: baseErrorSchema } },
        },
        NotFound: {
          description: 'Recurso no encontrado.',
          headers: publicApiResponseHeaders,
          content: { 'application/json': { schema: baseErrorSchema } },
        },
        IdempotencyConflict: {
          description: 'La misma idempotency-key fue usada con un payload distinto.',
          headers: publicApiResponseHeaders,
          content: { 'application/json': { schema: baseErrorSchema } },
        },
        RateLimited: {
          description: 'La credencial supero su limite de requests.',
          headers: {
            ...publicApiResponseHeaders,
            'retry-after': {
              description: 'Segundos recomendados antes de reintentar.',
              schema: { type: 'integer' },
            },
          },
          content: { 'application/json': { schema: baseErrorSchema } },
        },
        InternalError: {
          description: 'Error interno no esperado.',
          headers: publicApiResponseHeaders,
          content: { 'application/json': { schema: baseErrorSchema } },
        },
      },
      schemas: {
        ApiSuccessBase: {
          type: 'object',
          required: ['success', 'data', 'request_id'],
          properties: {
            success: { type: 'boolean', example: true },
            data: {},
            request_id: { type: 'string', format: 'uuid' },
          },
        },
        BalanceResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessBase' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    role: { type: 'string', enum: ['admin', 'superadmin', 'gestor', 'cliente'] },
                    balance: { type: 'number' },
                    cash_balance: { type: 'number' },
                    total_balance: { type: 'number' },
                    currency: { type: 'string', example: 'XAF' },
                    sandbox: { type: 'boolean', description: 'true cuando la credencial es test.' },
                  },
                },
              },
            },
          ],
        },
        CreateAgentTransferRequest: {
          type: 'object',
          required: ['sender_name', 'sender_phone', 'receiver_name', 'receiver_phone', 'destination_city', 'amount'],
          properties: {
            sender_name: { type: 'string' },
            sender_phone: { type: 'string' },
            sender_document_type: { type: 'string' },
            sender_document_number: { type: 'string' },
            receiver_name: { type: 'string' },
            receiver_phone: { type: 'string' },
            receiver_document_type: { type: 'string' },
            receiver_document_number: { type: 'string' },
            destination_city: { type: 'string' },
            destination_country: { type: 'string' },
            amount: { type: 'number', exclusiveMinimum: 0 },
            currency: { type: 'string', default: 'XAF' },
            notes: { type: 'string' },
          },
        },
        CreateAgentTransferResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessBase' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    transfer_id: { type: 'string', format: 'uuid' },
                    transfer_code: { type: 'string' },
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                    receiver_name: { type: 'string' },
                    receiver_phone: { type: 'string' },
                    destination_city: { type: 'string' },
                    status: { type: 'string', example: 'available_for_pickup' },
                    created_at: { type: 'string', format: 'date-time' },
                    sandbox: { type: 'boolean', description: 'true cuando la credencial es test.' },
                  },
                },
              },
            },
          ],
        },
        CreateWalletTransferRequest: {
          type: 'object',
          required: ['receiver_phone', 'receiver_name', 'amount'],
          properties: {
            receiver_phone: { type: 'string' },
            receiver_name: { type: 'string' },
            amount: { type: 'number', exclusiveMinimum: 0 },
            currency: { type: 'string', default: 'XAF' },
            notes: { type: 'string' },
          },
        },
        CreateWalletTransferResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessBase' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    transfer_id: { type: 'string', format: 'uuid' },
                    transfer_type: { type: 'string', example: 'wallet' },
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                    sender_name: { type: 'string' },
                    sender_phone: { type: 'string' },
                    receiver_name: { type: 'string' },
                    receiver_phone: { type: 'string' },
                    status: { type: 'string', example: 'completed' },
                    created_at: { type: 'string', format: 'date-time' },
                    new_balance: { type: 'number' },
                    sandbox: { type: 'boolean', description: 'true cuando la credencial es test.' },
                  },
                },
              },
            },
          ],
        },
        HistoryResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessBase' },
            {
              type: 'object',
              properties: {
                data: { type: 'array', items: { type: 'object' } },
                pagination: {
                  type: 'object',
                  properties: {
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                    has_more: { type: 'boolean' },
                    next_offset: { type: ['integer', 'null'] },
                  },
                },
              },
            },
          ],
        },
        WebhookEnvelopeBase: {
          type: 'object',
          required: ['id', 'event', 'created_at', 'data'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            event: {
              type: 'string',
              enum: ['transfer.created', 'transfer.paid_out', 'wallet_transfer.confirmed'],
            },
            created_at: { type: 'string', format: 'date-time' },
            data: { type: 'object' },
          },
        },
        TransferCreatedWebhook: {
          allOf: [
            { $ref: '#/components/schemas/WebhookEnvelopeBase' },
            {
              type: 'object',
              properties: {
                event: { type: 'string', const: 'transfer.created' },
                data: {
                  type: 'object',
                  properties: {
                    transfer_id: { type: 'string', format: 'uuid' },
                    transfer_code: { type: 'string' },
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                    status: { type: 'string', example: 'available_for_pickup' },
                    sender_name: { type: 'string' },
                    sender_phone: { type: 'string' },
                    receiver_name: { type: 'string' },
                    receiver_phone: { type: 'string' },
                    destination_city: { type: 'string' },
                    destination_country: { type: 'string', nullable: true },
                    source: { type: 'string', example: 'external_api' },
                  },
                },
              },
            },
          ],
        },
        TransferPaidOutWebhook: {
          allOf: [
            { $ref: '#/components/schemas/WebhookEnvelopeBase' },
            {
              type: 'object',
              properties: {
                event: { type: 'string', const: 'transfer.paid_out' },
                data: {
                  type: 'object',
                  properties: {
                    transfer_id: { type: 'string', format: 'uuid' },
                    transfer_code: { type: 'string' },
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                    status: { type: 'string', example: 'paid_out' },
                    sender_name: { type: 'string', nullable: true },
                    sender_phone: { type: 'string', nullable: true },
                    receiver_name: { type: 'string', nullable: true },
                    receiver_phone: { type: 'string', nullable: true },
                    destination_city: { type: 'string', nullable: true },
                    paid_out_at: { type: 'string', format: 'date-time', nullable: true },
                    paid_out_by: { type: 'string', format: 'uuid', nullable: true },
                    source: { type: 'string', example: 'dashboard' },
                  },
                },
              },
            },
          ],
        },
        WalletTransferConfirmedWebhook: {
          allOf: [
            { $ref: '#/components/schemas/WebhookEnvelopeBase' },
            {
              type: 'object',
              properties: {
                event: { type: 'string', const: 'wallet_transfer.confirmed' },
                data: {
                  type: 'object',
                  properties: {
                    transfer_id: { type: 'string', format: 'uuid' },
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                    status: { type: 'string', example: 'confirmed' },
                    sender_name: { type: 'string', nullable: true },
                    sender_phone: { type: 'string', nullable: true },
                    receiver_name: { type: 'string' },
                    receiver_phone: { type: 'string', nullable: true },
                    confirmed_at: { type: 'string', format: 'date-time', nullable: true },
                    source: { type: 'string', example: 'wallet_confirmation' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  });
}
