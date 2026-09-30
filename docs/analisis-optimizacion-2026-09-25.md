# Análisis de FondosEG: backend, frontend y fluidez

Fecha: 25 de septiembre de 2026. Referencia del censo: commit `4670453` y archivos de trabajo disponibles durante la revisión.

La prioridad es mejorar el recorrido completo entre consulta, respuesta y presentación: estadísticas calculadas en la base de datos, confirmación rápida de operaciones y estados visuales que distingan un error de un saldo cero. La arquitectura de monolito modular con Next.js y Supabase permite hacerlo incrementalmente.

## Alcance y límites

Se revisaron la estructura del repositorio, las rutas principales del dashboard, servicios HTTP, autorización, operaciones financieras, colas, SQL, estilos y pruebas. Se ejecutaron pruebas y comprobación de tipos. Esto no es una auditoría exhaustiva de seguridad ni certificación financiera.

No se midieron LCP, INP, CLS, latencia de producción, consultas con EXPLAIN ni tamaño de JavaScript transferido. No se accedió a datos reales ni se verificaron las migraciones desplegadas. La herramienta de navegador agotó el tiempo de espera; las observaciones visuales se basan en JSX y CSS, no en capturas o pruebas de uso. El peso de un recurso en disco no equivale a su descarga tras la optimización de Next Image.

## Porcentajes reproducibles

Métrica: líneas físicas no vacías, incluidos comentarios, de archivos fuente versionados. Extensiones: TS, TSX, JS, MJS, CJS, CSS y SQL. Se excluyen dependencias, archivos generados del SDK, documentación, skills, imágenes, JSON y lockfiles. Una pantalla renderizada en servidor cuenta como frontend por responsabilidad de presentación; no se está midiendo dónde se ejecuta cada byte.

Se clasifican separadamente los servicios de servidor (`client`, `wallet-transfer`, `withdrawal`, `sms`) y los clientes HTTP. Los tipos y utilidades transversales no se asignan artificialmente a una de las dos capas.

| Parte | Archivos | Líneas no vacías | % del censo completo |
| --- | ---: | ---: | ---: |
| Frontend y clientes HTTP | 134 | 20.756 | 47,60 % |
| Backend TypeScript | 105 | 11.706 | 26,84 % |
| Backend SQL y Edge Functions | 41 | 7.383 | 16,93 % |
| Código compartido | 13 | 1.568 | 3,60 % |
| SDK de integraciones | 6 | 496 | 1,14 % |
| Pruebas | 10 | 1.014 | 2,33 % |
| Herramientas y configuración fuente | 11 | 683 | 1,57 % |
| Total | 320 | 43.606 | 100 % |

Puede haber una diferencia de 0,01 puntos por redondeo.

**Comparando exclusivamente frontend y backend: frontend 52,09 %; backend 47,91 %.** El denominador son 39.845 líneas y el backend incluye 19.089 líneas entre TS, SQL y Edge Functions.

Si se excluye el directorio Supabase completo, la comparación cambia a frontend 63,94 % y backend TS 36,06 %. Las migraciones incluyen versiones históricas de funciones, por lo que el primer reparto describe el código mantenido, no únicamente la lógica SQL actualmente desplegada. Ninguno de estos porcentajes representa avance, calidad, cobertura de pruebas, tiempo de desarrollo ni consumo de CPU.

Inventario adicional: 70 archivos de rutas API; 31 páginas; 13 de las 14 páginas del grupo dashboard declaran `use client` (92,86 %); 21 archivos CSS y 3.729 líneas CSS no vacías. Las rutas versionadas que reexportan implementaciones se cuentan como archivos, no como funcionalidades independientes.

Datos por archivo: `docs/audit-source-metrics.json`. Repetición: `node docs/audit-source-metrics.mjs`. El censo usa la lista de archivos versionados y lee su contenido actual; para comparar revisiones conviene ejecutarlo sobre un checkout limpio del commit correspondiente.

## Cómo se conectan las capas

1. El layout del dashboard resuelve la identidad, consulta acceso al producto y obtiene el perfil.
2. `AppProvider` escribe el usuario en Zustand desde un efecto del cliente.
3. La página del dashboard inicia sus consultas HTTP después de tener usuario: dos para cliente, tres para gestor y cuatro para administrador, sin contar las del shell.
4. Cada ruta resuelve su autorización y consulta Supabase con el cliente privilegiado del servidor.
5. Las estadísticas de varias rutas agregan registros en JavaScript; las operaciones financieras principales llaman RPC.
6. El navegador presenta los resultados; la cabecera consulta periódicamente notificaciones y, para gestores, saldo.

Hay consultas paralelas tanto en frontend como backend. El problema no es ausencia total de paralelismo, sino etapas consecutivas, trabajo repetido y dependencias innecesarias antes de responder.

## Hallazgos priorizados

### 1. Estadísticas: trasladar agregaciones a PostgreSQL — prioridad alta

Evidencia: `app/api/dashboard/stats/route.ts:96`, `app/api/dashboard/daily-transfer-stats/route.ts:36` y `app/api/dashboard/agent-transfer-stats/route.ts:15`.

Estas consultas recuperan filas y calculan sumas, recuentos y agrupaciones con `filter`, `reduce` y `Map`. La consulta general de transferencias de stats no limita por fecha; las diarias sí filtran fechas, pero también agregan filas recibidas en la aplicación.

Además del coste de transferencia y memoria, existe riesgo de totales truncados: Supabase devuelve por defecto un máximo de 1.000 filas, configurable. No se verificó el límite de este despliegue. La solución recomendada son RPC o vistas agregadas con SUM, COUNT y GROUP BY, filtradas por usuario, rol y período. Un contador debe contar en SQL; no descargar todos los identificadores. [Documentación de select](https://supabase.com/docs/reference/javascript/v1/select).

Ya existen índices. Revisar planes con EXPLAIN ANALYZE y datos de staging antes de añadir otros; evaluar índices compuestos según los filtros y orden reales, por ejemplo agente y fecha, evitando índices redundantes. [Optimización de consultas](https://supabase.com/docs/guides/database/query-optimization).

Validación: fixtures de más de 1.000 movimientos, comparación con agregados SQL independientes, separación por usuario y medición de latencia y bytes antes/después.

### 2. Confirmación de envíos bloqueada por notificaciones — prioridad alta

Evidencia: `app/api/transfers/route.ts:183` espera `processNotificationOutbox(5)` y después `emitWebhookEvent`. En `lib/server/webhook-outbox.ts:104`, emitir el evento procesa entregas; el fetch de la entrega no establece un plazo de espera explícito.

Un pago ya registrado puede tardar en confirmarse visualmente mientras espera proveedores externos. La cola procesada puede incluir trabajos anteriores. Conviene confirmar tras la transacción y el registro duradero de eventos; entregar SMS y webhooks en un worker con reintentos, timeout y reclamación atómica de trabajos. No sustituirlo simplemente por una promesa sin await, porque puede perderse al terminar la ejecución del servidor.

Revisar también la operación de gestor: `recordPaymentConsent` se espera después de crear la transferencia y antes de los bloques que toleran fallos de notificaciones. Un fallo ahí podría devolver error pese a haber creado el movimiento. La evidencia necesaria para la operación debe persistirse atómicamente con ella; mantener idempotencia al reintentar.

Validación: simular SMS y webhooks lentos/caídos, comprobar que la confirmación no depende de ellos y que dos workers no procesan el mismo trabajo simultáneamente.

### 3. Errores que pueden parecer saldo cero — prioridad alta

Evidencia: `app/(dashboard)/dashboard/page.tsx:59`: Promise.all, un único catch que registra en consola y finally que finaliza la carga. Los indicadores usan fallbacks como `stats?.monthlyVolume ?? 0`.

Si falla una consulta del grupo, no se aplican los resultados de las demás y desaparece el estado de carga. Se pueden presentar ceros como si fueran información válida. Separar estados por bloque: cargando, disponible, vacío y error. Mostrar reintento, fecha de actualización y conservar datos anteriores cuando corresponda. Un saldo desconocido debe mostrarse como no disponible, nunca inferirse como cero.

Dividir las promesas por sección o usar resultados independientes. `Promise.allSettled` evita perder resultados útiles, pero por sí solo sigue esperando al más lento; para mostrar cada bloque pronto se necesitan estados o límites de streaming independientes.

### 4. Historial que busca solo en una muestra — prioridad alta

Evidencia: `app/(dashboard)/history/page.tsx:76` carga 150 transferencias y `:91` filtra ese array por texto y estado. Los totales de esa pantalla se calculan sobre lo cargado.

Un usuario puede buscar una transferencia anterior y creer que no existe. Añadir paginación y búsqueda en servidor, con filtros por fecha y estado, cursor estable y alcance por usuario. Mostrar explícitamente cuándo un total representa la página, el período o todo el historial. Para clientes con dos fuentes de movimientos, construir una paginación coherente del conjunto.

Validación: encontrar una transferencia fuera de las primeras 150, navegar sin saltos/duplicados y comprobar el aislamiento entre usuarios.

### 5. Reducir etapas de carga y peticiones repetidas — prioridad media-alta

Evidencia: `app/(dashboard)/layout.tsx`, `components/providers/app-provider.tsx` y `services/dashboard.ts`.

El primer contenido con datos espera la identidad en servidor, la hidratación, el efecto del proveedor, el efecto de la página y las llamadas API. El layout también vuelve a leer el perfil tras resolver la identidad.

Preparar datos iniciales en servidor y pasarlos a islas interactivas; dividir secciones mediante Suspense donde sea apropiado. Otra opción incremental es una consulta de resumen específica para el dashboard y una caché de consultas cliente compartida. Evitar duplicar el estado remoto en Zustand y estados locales. Deduplicar resolución del perfil dentro de la misma petición, sin cachés globales que mezclen usuarios o retrasen revocaciones. [Carga de datos y streaming](https://nextjs.org/docs/app/getting-started/fetching-data).

Para la caché: consultas históricas y agregados toleran políticas diferentes de un saldo financiero. Invalidar tras mutaciones y revalidar el saldo antes de operar; nunca confirmar dinero mediante un cambio optimista que el servidor aún no ha aceptado.

### 6. Polling continuo del shell — prioridad media

Evidencia: `components/layout/dashboard-layout-wrapper.tsx:281` y `:303`: intervalos de 30 segundos para notificaciones y saldo del gestor.

Para un gestor son aproximadamente cuatro peticiones por minuto y pestaña solo por esos dos intervalos, aparte de la carga inicial. No se ve una condición de visibilidad en esos efectos. Pausar cuando la pestaña está oculta, revalidar al recuperar el foco, cancelar peticiones obsoletas y evitar solapamientos. Compartir consultas con otras vistas que pidan el mismo saldo. Evaluar eventos en tiempo real si la necesidad lo justifica y preservando autorización por usuario.

### 7. Menos JavaScript inicial y componentes más pequeños — prioridad media

El shell importa estáticamente búsqueda, ajustes, soporte y modales de detalles. Ya existe carga dinámica de seis módulos en `components/dashboard/dashboard-module-panel.tsx`; mantenerla y extender la misma idea a los modales secundarios. [Carga diferida en Next.js](https://nextjs.org/docs/app/guides/lazy-loading).

No es necesario transformar cada pantalla a Server Component. Extraer presentación estable y dejar formularios, filtros y gráficos como islas cliente. No afirmar un ahorro concreto de KB hasta medir el build.

Archivos grandes del censo, en líneas no vacías: desarrolladores 866, administración 825, modal de envío 782, balance 758 y shell 754. Separar consulta/estado, formulario, tabla y presentación facilita pruebas y mantenimiento; dividir archivos sin cambiar imports o responsabilidades no garantiza acelerar el navegador.

El dashboard usa Recharts para tres barras de un único valor. Esas barras podrían ser indicadores HTML/CSS accesibles; conservar Recharts para gráficos que sí necesitan ejes, series y tooltips.

### 8. Fuentes, imágenes y CSS global — prioridad media

`app/layout.tsx` importa seis pesos de Poppins y cuatro de Plus Jakarta Sans. Reducir a pesos realmente usados, estudiar fuentes variables o subconjuntos y medir qué archivos pide el navegador. Diez imports no significan necesariamente diez descargas de fuentes en cada página.

Recursos de origen: `public/mockup.png` 2,94 MB; `public/images/dashboard-desk.png` 1,63 MB; logo LFondosEG 541,5 KB. Se usa Next Image en varias ubicaciones, lo cual ya ayuda. Ajustar resolución y `sizes`; el hero del mockup no declara `sizes`. El poster del vídeo y el icono PNG pueden seguir otras rutas de descarga. Crear un favicon pequeño y optimizar los originales antes de valorar bytes finales.

`app/globals.css` incorpora estilos de marketing, autenticación, documentación, dashboard y modales. Mantener tokens/base globales y estudiar CSS por ruta o módulos. `system-surfaces.css` usa overrides con `!important`: migrar gradualmente hacia componentes y variantes semánticas para que un cambio no afecte pantallas ajenas. Ya se desactiva backdrop-filter en varias superficies; no atribuir un problema de FPS a efectos que esos overrides han eliminado.

### 9. Consistencia de cifras y estados — prioridad media-alta

`history/page.tsx` cuenta completadas solo con `status === 'completed'`; las estadísticas usan helpers que también normalizan otros estados, incluido `paid_out`. Unificar las reglas de estado y períodos entre vistas para que la misma operación no cambie de significado al navegar.

En `stats/route.ts` se agrupan saldos por divisa y luego se suman los importes crudos para el total. Si coexisten varias divisas, ese total necesita conversión explícita con fecha/tasa o presentación separada. Si el producto opera exclusivamente en XAF, documentar y validar esa restricción. También alinear días de negocio: algunas rutas mezclan inicio del día local con claves construidas en UTC.

### 10. Verificación funcional y observabilidad — prioridad alta antes de publicar cambios

Las 92 pruebas existentes pasan. Varias pruebas financieras/API inspeccionan cadenas y expresiones del código: protegen contratos estructurales, pero no ejecutan transacciones simultáneas ni validan toda la interfaz. La proporción de líneas de tests, 2,33 %, no es cobertura.

Añadir pruebas de integración para invariantes de saldo, doble envío, doble retiro y reversión ante fallo; E2E para login, envío, historial y estados de error; controles visuales en móvil/escritorio y temas claro/oscuro. Instrumentar errores y latencia por ruta interna, además de los logs ya previstos para API pública.

La comprobación `npm run typecheck` falló por TS6053: falta `node_modules/@types/phoenix/index.d.ts`. Resolver la instalación local de dependencias y repetir CI; no hay evidencia suficiente para atribuirlo a una línea de negocio. No se certificó un build de producción. `npm run lint` se interrumpió tras permanecer sin resultado final; no se considera aprobado.

## Tips visuales concretos

| Área | Cambio propuesto | Cómo comprobarlo |
| --- | --- | --- |
| Jerarquía del dashboard | Primera pantalla: saldo disponible, una acción principal y actividad reciente; mover analítica secundaria a un segundo nivel | El usuario identifica cuánto tiene y qué puede hacer sin buscar entre KPIs |
| Diferenciación por rol | Cliente: enviar/retirar; gestor: nuevo envío/pagar retiro; administrador: liquidez y excepciones | Probar una tarea principal por rol |
| Importes | Cifras tabulares, moneda visible, decimales coherentes y etiquetas distintas para disponible/retenido | Comparar saldo, historial y recibo del mismo movimiento |
| Cargas y errores | Skeleton con dimensiones del contenido, error local y botón Reintentar; no sustituir error por cero | Simular fallo de una sola consulta |
| Formularios | Agrupar destinatario, importe/comisión y revisión; resumen antes de confirmar; mensajes junto al campo | Completar un envío con teléfono o importe inválido |
| Color | Marca para acción; éxito/aviso/error con significado estable, icono y texto | Entender estados sin depender solo del color |
| Tipografía | Reducir etiquetas minúsculas y mayúsculas espaciadas; usar tamaño legible en importes y tablas | Revisar 360–390 px, zoom 200 % y ambos temas |
| Modales | Reservarlos para tareas cortas; evaluar vistas completas para administración/historial largos | Revisar foco, atrás, Escape, scroll y teclado móvil |
| Movimiento | Transiciones breves y funcionales; conservar reduced-motion existente | Navegar con movimiento reducido activado |
| Móvil | Priorización de columnas, acciones táctiles cómodas y formulario visible con teclado | Probar los recorridos en dispositivo real |

Son propuestas de diseño basadas en la implementación; requieren validación visual antes de fijar contraste o accesibilidad como aprobados.

## Orden de ejecución y criterios de éxito

| Etapa | Entregable | Criterio de aceptación |
| --- | --- | --- |
| 1. Fiabilidad visible | Estados de error, estadísticas SQL e historial paginado | Totales exactos con más de 1.000 registros; ningún error mostrado como saldo cero; búsqueda encuentra movimientos antiguos |
| 2. Respuesta rápida | Worker de notificaciones y consultas iniciales revisadas | La confirmación no espera proveedores; menos peticiones y menor latencia medidas en el mismo entorno |
| 3. Fluidez visual | Modales diferidos, fuentes/recursos optimizados, jerarquía por rol | Menos bytes iniciales medidos; sin pérdida de foco ni contenido oculto en móvil |
| 4. Protección continua | Integración, E2E, métricas y CI reproducible | Pruebas de dinero concurrente y navegación completas; regresiones detectadas antes del despliegue |

Medir antes y después con el mismo dispositivo, red, rol y conjunto de datos. Objetivos de experiencia: LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1, evaluados en el percentil 75 de visitas; son umbrales de referencia, no resultados actuales. [Core Web Vitals](https://web.dev/articles/vitals).

Para backend, definir objetivos internos después de medir la línea base: p50/p95 de lectura y escritura, tamaño de respuesta, número de consultas y tasa de errores. Evitar promesas como “será un 40 % más rápido” sin una medición comparable.

