# Analisis de Desarrollo FondosEG y Plataforma API

Fecha: 2026-04-22

## Estado General

Estimacion global de desarrollo de la aplicacion: 68%.

La aplicacion ya tiene una base funcional solida para dashboard financiero: autenticacion, roles, gestion de transferencias, saldos, historial, estadisticas, notificaciones, staff y operaciones financieras con Supabase. La parte de APIs externas existe como MVP tecnico, pero todavia necesita madurez de producto, seguridad, contratos publicos y observabilidad para ser usada con confianza desde otro proyecto.

## Estado Por Modulo

| Area | Estado estimado | Observacion |
| --- | ---: | --- |
| Dashboard y navegacion | 75% | Flujos principales construidos con App Router y componentes reutilizables. |
| Autenticacion y roles | 70% | Supabase SSR, perfiles, roles y protecciones server-side. Falta endurecer gestion de sesiones y auditoria completa. |
| Transferencias y saldos | 72% | Hay RPCs financieros, historial y balance. Falta test automatizado de casos contables criticos. |
| Notificaciones | 60% | Twilio/cola outbox parcialmente presente. Falta worker/reintentos operativos y monitoreo. |
| Staff/admin | 65% | Gestion administrativa disponible, pero falta trazabilidad y permisos finos. |
| APIs externas | 45% | Existen endpoints y API keys. Faltaban portal, secret hashing conectado, rate limit e idempotencia. |
| Portal de desarrolladores | 20% antes / 45% despues | Se agrego una primera pantalla funcional para credenciales y ejemplos. |
| Calidad/QA | 35% | No hay suite visible de tests. Typecheck/build deben integrarse en CI. |
| Documentacion publica | 30% | README general existe. Falta OpenAPI, ejemplos por SDK y guia de errores. |

## APIs Existentes

Endpoints externos disponibles:

- `GET /api/external/balance`
- `GET /api/external/history`
- `POST /api/external/transfer`
- `POST /api/external/wallet-transfer`

Endpoint interno para credenciales:

- `GET /api/api-keys`
- `POST /api/api-keys`
- `DELETE /api/api-keys?id=...`

Infraestructura API existente:

- Tabla `api_keys`.
- Tabla `api_idempotency_keys`.
- Tabla `api_key_usage_windows`.
- Utilidades para generar API key/secret.
- Permisos por credencial: `balance`, `transfer`, `history`.

## Lo Que Faltaba y Se Implemento

- Portal inicial en `/developers`.
- Menu lateral hacia el portal.
- Servicio cliente `services/api-keys.ts`.
- Tipos TypeScript para credenciales API.
- Creacion de secrets hasheados para nuevas credenciales.
- Listado de credenciales sin exponer `api_secret` completo.
- Revocacion suave con `is_active = false`.
- Rate limit por ventana usando `api_key_usage_windows`.
- Idempotencia en transferencias externas con header `idempotency-key`.

## Prioridades Pendientes Para Produccion API

1. Publicar contrato OpenAPI 3.1 en `/api/docs/openapi.json`.
2. Crear documentacion versionada: autenticacion, errores, rate limit, idempotencia y ejemplos.
3. Unificar respuestas de error con formato estable: `code`, `message`, `request_id`, `details`.
4. Mover todas las operaciones financieras externas a RPCs atomicas.
5. Agregar logs de uso por request: endpoint, status, latencia, api_key_id y request_id.
6. Crear entornos separados sandbox/produccion para credenciales.
7. Agregar rotacion de secretos sin borrar la credencial.
8. Implementar webhooks para cambios de estado de transferencias.
9. Anadir tests de contrato y tests de regresion financiera.
10. Preparar SDK minimo para el otro proyecto: TypeScript client con retries, idempotencia y tipos.

## Roadmap Recomendado

Fase 1: Base segura de APIs.

- Terminar autenticacion de API keys con hashing, rate limit e idempotencia en todos los endpoints que mueven dinero.
- Crear formato estandar de errores.
- Agregar request IDs.
- Documentar payloads y respuestas.

Fase 2: Portal de desarrolladores.

- Crear pantalla de credenciales, permisos y ejemplos.
- Agregar rotacion de secret.
- Agregar estadisticas de uso por credencial.
- Permitir sandbox keys y produccion keys.

Fase 3: Producto API.

- Publicar OpenAPI.
- Crear SDK TypeScript.
- Agregar webhooks firmados.
- Agregar panel de eventos y reintentos.
- Crear guia de integracion para el otro proyecto.

Fase 4: Operacion y cumplimiento.

- CI con typecheck, lint y tests.
- Auditoria de acciones administrativas.
- Monitoreo de errores y latencia.
- Backups, runbooks y alertas.
