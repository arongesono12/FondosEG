export type MarketingSection = {
  title: string;
  description: string;
  items: string[];
};

export type MarketingPageContent = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  destination: string;
  points: string[];
  sections: MarketingSection[];
  note: string;
};

export const marketingPages = {
  'transferencias-instantaneas': {
    eyebrow: 'Transferencias',
    title: 'Transferencias conectadas con todo el ciclo operativo',
    description: 'FondosEG permite crear, localizar, pagar y seguir transferencias en XAF desde un flujo centralizado, con reglas distintas para gestores y clientes.',
    cta: 'Comenzar una transferencia',
    destination: '/register',
    points: ['Código único por operación', 'Estados y fechas de seguimiento', 'Comisión calculada para transferencias de gestor'],
    sections: [
      { title: 'Creación controlada', description: 'El sistema reúne los datos necesarios del ordenante, beneficiario y destino antes de registrar la operación.', items: ['Importe y moneda XAF', 'Datos de contacto y documentación', 'Ciudad y país de destino', 'Código de transferencia generado por el sistema'] },
      { title: 'Flujos según el usuario', description: 'La aplicación diferencia las operaciones realizadas por gestores de los movimientos entre clientes registrados.', items: ['Débito del saldo del gestor al crear el envío', 'Transferencias entre billeteras de clientes', 'Reserva de saldo cuando corresponde', 'Validación del rol y del propietario de la operación'] },
      { title: 'Seguimiento hasta el pago', description: 'Cada transferencia conserva su estado y las referencias necesarias para continuar el proceso.', items: ['Estados creada, disponible, pagada, completada o cancelada', 'Búsqueda mediante código', 'Registro de disponibilidad y pago', 'Recibo y notificaciones asociadas'] },
    ],
    note: 'La velocidad final de una operación depende de su validación, disponibilidad de saldo, estado y proveedor de pago configurado.',
  },
  'billetera-segura': {
    eyebrow: 'Billetera',
    title: 'Saldo, reservas y movimientos protegidos por permisos',
    description: 'Las billeteras de FondosEG separan los saldos de clientes y gestores y aplican autenticación, autorización por rol y operaciones financieras ejecutadas en la base de datos.',
    cta: 'Crear mi billetera',
    destination: '/register',
    points: ['Saldos separados por tipo de cuenta', 'Fondos reservados durante operaciones', 'Acceso limitado al usuario autorizado'],
    sections: [
      { title: 'Un saldo para cada rol', description: 'Al crear la cuenta, FondosEG prepara el recurso financiero correspondiente al perfil seleccionado.', items: ['Billetera de cliente en client_balances', 'Saldo operativo del gestor en agent_balances', 'Moneda XAF configurada', 'Saldo inicial registrado en cero'] },
      { title: 'Consistencia financiera', description: 'Los cambios de saldo se realizan mediante funciones de base de datos que validan la operación y conservan sus resultados.', items: ['Comprobación de saldo disponible', 'Bloqueo de registros durante movimientos sensibles', 'Saldo disponible y reservado', 'Valores anteriores y posteriores en eventos financieros'] },
      { title: 'Acceso y protección', description: 'El acceso combina Supabase Auth con comprobaciones de sesión, rol y propiedad.', items: ['Correo confirmado mediante OTP', 'Rutas privadas protegidas', 'Políticas Row Level Security', 'Claves y secretos fuera de la interfaz pública'] },
    ],
    note: 'La protección efectiva también depende de la configuración segura de Supabase, las variables de entorno y las prácticas del usuario.',
  },
  'trazabilidad-completa': {
    eyebrow: 'Trazabilidad',
    title: 'Cada movimiento conserva su contexto operativo',
    description: 'El historial, los eventos financieros y los registros de actividad permiten reconstruir qué ocurrió en una transferencia y consultar su situación actual.',
    cta: 'Consultar mis operaciones',
    destination: '/login',
    points: ['Historial filtrado por permisos', 'Estados y marcas de tiempo', 'Eventos financieros y actividad'],
    sections: [
      { title: 'Historial de transferencias', description: 'La vista de historial presenta las operaciones accesibles para el usuario autenticado.', items: ['Código, importe y participantes', 'Estado operativo actual', 'Fecha de creación y finalización', 'Detalle y recibo de la transferencia'] },
      { title: 'Registro financiero', description: 'Las operaciones importantes guardan información que explica la variación de los fondos.', items: ['Débitos, créditos, reservas y liberaciones', 'Saldo anterior y saldo resultante', 'Referencia a la transferencia', 'Comisión y regla aplicada cuando corresponde'] },
      { title: 'Informes operativos', description: 'Gestores y administradores disponen de indicadores construidos desde los datos almacenados.', items: ['Volumen por periodos', 'Operaciones por estado', 'Comisiones y conciliación', 'Actividad diaria y rendimiento por gestor'] },
    ],
    note: 'La información mostrada respeta el rol del usuario: los clientes consultan sus operaciones y los perfiles autorizados acceden al alcance operativo correspondiente.',
  },
  'api-integraciones': {
    eyebrow: 'Integraciones',
    title: 'API para conectar operaciones y sistemas externos',
    description: 'FondosEG incluye una API documentada, credenciales por entorno, permisos por recurso, idempotencia, registros de uso y webhooks firmados.',
    cta: 'Abrir documentación',
    destination: '/documentation',
    points: ['Credenciales test y production', 'Contrato OpenAPI disponible', 'Webhooks firmados y auditables'],
    sections: [
      { title: 'Acceso a la API', description: 'Las integraciones se autentican mediante una clave y un secreto asociados a su propietario y entorno.', items: ['Cabeceras x-api-key y x-api-secret', 'Permisos por balance, transferencias e historial', 'Rotación y revocación de credenciales', 'Rate limits y registros de solicitudes'] },
      { title: 'Operaciones disponibles', description: 'Los endpoints existentes cubren recursos financieros y los módulos externos incorporados al proyecto.', items: ['Consulta de balance e historial', 'Transferencias de gestor y billetera', 'Propiedades y contratos de alquiler', 'Pagos de alquiler y estados'] },
      { title: 'Automatización fiable', description: 'La API incorpora mecanismos para coordinar operaciones con otros sistemas.', items: ['Idempotency-Key en escrituras compatibles', 'Entorno sandbox sin afectar saldos reales', 'Webhooks con firma HMAC SHA-256', 'Entregas, reintentos y estados registrados'] },
    ],
    note: 'Cada integración sólo puede utilizar las rutas y permisos habilitados para sus credenciales. El sandbox devuelve datos simulados identificados como tales.',
  },
  funciones: {
    eyebrow: 'Producto',
    title: 'Las funciones que ya operan dentro de FondosEG',
    description: 'La plataforma reúne transferencias de gestores, movimientos entre billeteras, saldos, historial, notificaciones, soporte e integraciones en un solo flujo.',
    cta: 'Crear una cuenta',
    destination: '/register',
    points: ['Transferencias de gestores y clientes', 'Saldos disponibles y reservados', 'Historial y estados operativos'],
    sections: [
      { title: 'Transferencias de gestores', description: 'Los gestores pueden crear transferencias en XAF con datos del ordenante, beneficiario, documentos, ciudad de destino e importe.', items: ['Código único por transferencia', 'Cálculo de comisión según el importe', 'Estados creada, disponible, pagada y cancelada', 'Consentimiento previo del servicio de pago'] },
      { title: 'Billeteras de clientes', description: 'Los clientes registrados pueden transferir saldo a otro cliente mediante teléfono, verificación y confirmación.', items: ['Reserva de saldo durante la operación', 'Código y QR de verificación', 'Confirmación, cancelación y expiración', 'Actualización de ambos saldos en una transacción'] },
      { title: 'Seguimiento operativo', description: 'La aplicación conserva el contexto necesario para consultar cada movimiento y actuar según el rol.', items: ['Historial combinado de transferencias', 'Notificaciones internas y SMS configurables', 'Recibos y referencias de operación', 'Soporte y reclamaciones vinculadas a transacciones'] },
    ],
    note: 'Estas funciones corresponden a rutas, componentes y operaciones presentes actualmente en el repositorio.',
  },
  seguridad: {
    eyebrow: 'Producto',
    title: 'Controles de seguridad incorporados al sistema',
    description: 'FondosEG aplica autenticación, autorización por rol, aislamiento de datos, trazabilidad y protección específica para APIs y webhooks.',
    cta: 'Crear una cuenta',
    destination: '/register',
    points: ['Autenticación mediante Supabase', 'Permisos según rol y propietario', 'Auditoría de operaciones sensibles'],
    sections: [
      { title: 'Acceso y autorización', description: 'Las páginas privadas y rutas API validan sesión, perfil y rol antes de acceder a información o ejecutar cambios.', items: ['Roles cliente, gestor, admin y superadmin', 'Comprobaciones de propietario o administrador', 'Row Level Security en tablas sensibles', 'Separación entre vistas públicas y dashboard'] },
      { title: 'Operaciones financieras', description: 'Las funciones de base de datos bloquean registros durante cambios de saldo y guardan el resultado financiero.', items: ['Saldo anterior y posterior', 'Reservas para transferencias pendientes', 'Idempotencia en operaciones API', 'Eventos financieros y registros de actividad'] },
      { title: 'Integraciones', description: 'Las credenciales y entregas externas disponen de controles propios.', items: ['Secretos API almacenados mediante hash', 'Rotación y revocación de credenciales', 'Webhooks firmados con HMAC SHA-256', 'Rate limits y logs de solicitudes'] },
    ],
    note: 'La seguridad efectiva también depende de la configuración de producción, custodia de secretos, proveedores y procedimientos operativos.',
  },
  precios: {
    eyebrow: 'Producto',
    title: 'Tarifas XAF definidas en la aplicación',
    description: 'Las transferencias de gestores utilizan la tabla nacional versionada 2026-default. La comisión se selecciona automáticamente según el importe.',
    cta: 'Comenzar ahora',
    destination: '/register',
    points: ['Importes entre 1.000 y 2.000.000 XAF', 'Trece tramos tarifarios definidos', 'Regla y comisión guardadas en cada operación'],
    sections: [
      { title: 'Tramos de 1.000 a 250.000 XAF', description: 'Primeros cinco rangos configurados.', items: ['1.000–20.000: 500 XAF', '20.001–50.000: 1.000 XAF', '50.001–85.000: 2.000 XAF', '85.001–160.000: 2.500 XAF', '160.001–250.000: 3.000 XAF'] },
      { title: 'Tramos de 250.001 a 750.000 XAF', description: 'Cuatro rangos intermedios configurados.', items: ['250.001–350.000: 3.500 XAF', '350.001–400.000: 4.000 XAF', '400.001–500.000: 6.000 XAF', '500.001–750.000: 7.000 XAF'] },
      { title: 'Tramos de 750.001 a 2.000.000 XAF', description: 'Cuatro rangos superiores configurados.', items: ['750.001–900.000: 9.000 XAF', '900.001–1.200.000: 11.000 XAF', '1.200.001–1.500.000: 16.000 XAF', '1.500.001–2.000.000: 18.000 XAF'] },
    ],
    note: 'Las transferencias entre billeteras de clientes están implementadas sin comisión. Los importes fuera de los tramos no obtienen una tarifa en la tabla actual.',
  },
  novedades: {
    eyebrow: 'Producto',
    title: 'Cambios recientes presentes en FondosEG',
    description: 'Este historial resume funcionalidades incorporadas mediante las migraciones y módulos fechados del repositorio.',
    cta: 'Explorar la plataforma',
    destination: '/register',
    points: ['Cumplimiento CEMAC', 'Pagos de alquiler', 'API test y production'],
    sections: [
      { title: 'Junio de 2026', description: 'Las incorporaciones más recientes se enfocan en cumplimiento e integraciones de pagos.', items: ['Eventos de consentimiento y cumplimiento CEMAC', 'Reclamaciones con referencia y fecha objetivo', 'Propiedades, alquileres y pagos asociados', 'Entornos test y production para claves API'] },
      { title: 'Mayo de 2026', description: 'Se añadió el flujo opcional de payout externo.', items: ['Enlaces de payout mediante Revolut', 'Estados y caducidad del enlace', 'Métodos Revolut y cuenta bancaria configurables', 'Evento webhook al generar el enlace'] },
      { title: 'Abril de 2026', description: 'Se consolidó la base financiera y developer.', items: ['Eventos financieros y reglas tarifarias', 'Outbox de notificaciones SMS', 'Claves API, uso, idempotencia y rate limits', 'Webhooks firmados y rotación de secretos'] },
    ],
    note: 'La cronología se deriva exclusivamente de migraciones y módulos existentes; no representa una promesa sobre próximas versiones.',
  },
  dashboard: {
    eyebrow: 'Para gestores',
    title: 'Una vista operativa construida con datos reales del sistema',
    description: 'El dashboard adapta sus indicadores al rol autenticado y consulta balances, transferencias y movimientos almacenados en FondosEG.',
    cta: 'Entrar al dashboard',
    destination: '/login',
    points: ['Saldo disponible y exposición pendiente', 'Volumen y comisiones por periodo', 'Salud de liquidez y operación'],
    sections: [
      { title: 'Tesorería', description: 'Los gestores y administradores disponen de indicadores calculados sobre saldos y operaciones.', items: ['Saldo disponible y reservado', 'Exposición en transferencias pendientes', 'Cobertura estimada de liquidez', 'Utilización del float y recargas proyectadas'] },
      { title: 'Actividad', description: 'El dashboard distingue operaciones por estado y periodo.', items: ['Transferencias de hoy', 'Volumen de hoy, 7 y 30 días', 'Completadas, pendientes y canceladas', 'Operaciones listas para pago'] },
      { title: 'Rendimiento', description: 'Los datos almacenados permiten revisar el resultado operativo.', items: ['Comisión diaria, mensual, anual y acumulada', 'Ticket medio y comisión media', 'Tasa de liquidación', 'Gestores activos y saldos bajo umbral'] },
    ],
    note: 'Los clientes ven sus propios saldos y transferencias; gestores y administradores reciben métricas acordes con sus permisos.',
  },
  liquidaciones: {
    eyebrow: 'Para gestores',
    title: 'Seguimiento del ciclo real de cada transferencia',
    description: 'FondosEG controla cuándo una transferencia está creada, disponible para cobro, pagada o cancelada y registra quién ejecuta el pago.',
    cta: 'Entrar al dashboard',
    destination: '/login',
    points: ['Estados normalizados', 'Pago por gestor autorizado', 'Opción de payout mediante Revolut'],
    sections: [
      { title: 'Creación y disponibilidad', description: 'Al crear una transferencia de gestor se debita el saldo, se calcula la comisión y queda disponible para pago.', items: ['Código único de transferencia', 'Fecha de disponibilidad', 'Comisión y regla tarifaria registradas', 'Notificaciones al ordenante y beneficiario'] },
      { title: 'Pago y cierre', description: 'La ruta de payout valida rol, estado y referencia antes de marcar la transferencia como pagada.', items: ['Registro de paid_out_at', 'Identificación del gestor que paga', 'Evento financiero de pago', 'Webhook transfer.paid_out'] },
      { title: 'Payout externo opcional', description: 'Las transferencias disponibles admiten la generación de un enlace Revolut cuando el proveedor está configurado.', items: ['Referencia y URL del payout', 'Estado, caducidad y métodos permitidos', 'Reutilización del enlace ya generado', 'Registro del resultado del proveedor'] },
    ],
    note: 'La disponibilidad de Revolut depende de las credenciales y variables de entorno configuradas; el pago por gestor permanece como proveedor predeterminado.',
  },
  reportes: {
    eyebrow: 'Para gestores',
    title: 'Indicadores y conciliación obtenidos de la operación',
    description: 'Los reportes se calculan desde transferencias, balances y transacciones financieras, respetando el alcance del usuario autenticado.',
    cta: 'Consultar mis reportes',
    destination: '/login',
    points: ['Serie diaria configurable', 'Comisiones por periodo', 'Conciliación de entradas y salidas'],
    sections: [
      { title: 'Serie de transferencias', description: 'El endpoint diario acepta periodos de 1 a 365 días para administradores y gestores.', items: ['Número de operaciones por día', 'Importe agregado diario', 'Sólo movimientos completados en el volumen', 'Filtro automático por gestor'] },
      { title: 'Resumen financiero', description: 'El dashboard calcula indicadores de rendimiento directamente desde las operaciones.', items: ['Volumen diario, semanal y mensual', 'Comisiones hoy, mes, año y total', 'Ticket y comisión media', 'Tasa de operaciones completadas'] },
      { title: 'Conciliación', description: 'Las transacciones de saldo se agrupan por periodo para explicar el movimiento neto.', items: ['Recargas', 'Salidas por transferencias', 'Reembolsos y restablecimientos', 'Flujo neto y número de movimientos'] },
    ],
    note: 'Los reportes reflejan la información almacenada en FondosEG y no sustituyen estados bancarios o contabilidad externa.',
  },
  soporte: {
    eyebrow: 'Para gestores',
    title: 'Soporte conectado con usuarios y operaciones',
    description: 'La aplicación registra solicitudes, envía avisos por los canales configurados y permite vincular reclamaciones con una referencia de transacción.',
    cta: 'Entrar y solicitar soporte',
    destination: '/login',
    points: ['Mensajes guardados con estado', 'Email y notificación interna', 'Flujo específico de reclamaciones'],
    sections: [
      { title: 'Solicitudes generales', description: 'Los usuarios autenticados pueden enviar un mensaje al equipo correspondiente.', items: ['Nombre, correo, tipo y mensaje', 'Estados pendiente, en curso, resuelto o cancelado', 'Correo mediante Resend cuando está configurado', 'Historial accesible para administradores'] },
      { title: 'Recargas de saldo', description: 'El gestor puede dirigir una solicitud de recarga a un administrador válido.', items: ['Validación del destinatario', 'Notificación interna de prioridad alta', 'SMS mediante Twilio si está configurado', 'Registro persistente de la solicitud'] },
      { title: 'Reclamaciones de pago', description: 'El flujo admite datos específicos para investigar una operación.', items: ['Referencia única de reclamación', 'Referencia de la transacción', 'Categoría y acuse de recepción', 'Fecha objetivo calculada a 15 días'] },
    ],
    note: 'El plazo de 15 días está implementado como objetivo operativo de respuesta, no como garantía automática de resolución.',
  },
  'api-reference': {
    eyebrow: 'Developers',
    title: 'Recursos disponibles en la API pública',
    description: 'La especificación OpenAPI del proyecto documenta autenticación, saldos, historial, transferencias, propiedades, alquileres, pagos y webhooks.',
    cta: 'Abrir documentación',
    destination: '/documentation',
    points: ['x-api-key y x-api-secret', 'Permisos por recurso', 'Respuestas con request_id'],
    sections: [
      { title: 'Consultas', description: 'Las credenciales autorizadas pueden leer recursos según sus permisos.', items: ['Balance por rol', 'Historial con limit, offset y filtros', 'Propiedades y contratos de alquiler', 'Pagos de alquiler y estados'] },
      { title: 'Operaciones', description: 'Los endpoints de escritura validan rol, payload, permisos y reglas financieras.', items: ['Transferencia de gestor', 'Transferencia entre billeteras', 'Creación de pagos de alquiler', 'Idempotency-Key para evitar duplicados'] },
      { title: 'Contrato técnico', description: 'La API devuelve una estructura consistente y cabeceras de diagnóstico.', items: ['success, data y request_id', 'Códigos de autenticación, permisos y validación', 'Rate limit con Retry-After', 'Webhooks firmados con identificador y timestamp'] },
    ],
    note: 'La documentación interactiva se genera desde la ruta OpenAPI incluida en la aplicación.',
  },
  sandbox: {
    eyebrow: 'Developers',
    title: 'Entorno test separado de producción',
    description: 'Las claves sk_test utilizan respuestas sandbox implementadas en el servidor y no modifican los saldos de producción.',
    cta: 'Crear credenciales test',
    destination: '/developers-portal',
    points: ['Claves sk_test y sk_live', 'Datos simulados identificados', 'Mismos contratos principales de API'],
    sections: [
      { title: 'Datos disponibles', description: 'El sandbox devuelve ejemplos controlados marcados con sandbox: true.', items: ['Balance de cliente, gestor o administrador', 'Transferencia de gestor con código TST', 'Transferencia entre billeteras', 'Historial de prueba'] },
      { title: 'Recursos inmobiliarios', description: 'Las rutas externas incluyen ejemplos sandbox para probar el flujo de alquileres.', items: ['Propiedades de ejemplo', 'Contratos y periodos de alquiler', 'Pago con estado y referencia', 'URL de checkout simulada'] },
      { title: 'Pruebas seguras', description: 'El entorno test conserva los controles del contrato API.', items: ['Autenticación con clave y secreto', 'Permisos por balance, transfer, history, properties y payments', 'Idempotencia en operaciones de escritura', 'Logs de uso visibles en la consola developer'] },
    ],
    note: 'Los datos y saldos sandbox son simulados por código y nunca deben interpretarse como fondos reales.',
  },
  'estado-api': {
    eyebrow: 'Developers',
    title: 'Comprobaciones de salud disponibles en el proyecto',
    description: 'FondosEG incluye una función de salud que valida configuración, conexión con Supabase y respuesta de la API externa de balance.',
    cta: 'Abrir portal developer',
    destination: '/developers-portal',
    points: ['Comprobación de Supabase', 'Comprobación de API externa', 'Timestamp y estado HTTP'],
    sections: [
      { title: 'Configuración', description: 'La función informa si existen las variables necesarias sin revelar sus valores.', items: ['URL de Supabase', 'Service role key', 'Base URL de FondosEG', 'API key y API secret externos'] },
      { title: 'Dependencias', description: 'El chequeo realiza operaciones concretas para verificar conectividad.', items: ['Consulta limitada sobre api_keys', 'Petición a /api/external/balance', 'Estado HTTP del destino', 'Vista previa de la respuesta externa'] },
      { title: 'Diagnóstico Developer', description: 'La consola registra el uso de las claves para ayudar a investigar integraciones.', items: ['Método y ruta solicitada', 'Código de estado y error', 'Latencia en milisegundos', 'Resumen de éxitos y errores'] },
    ],
    note: 'El repositorio contiene estas comprobaciones técnicas, pero no una página pública de SLA o historial de incidentes.',
  },
} satisfies Record<string, MarketingPageContent>;

export type MarketingPageSlug = keyof typeof marketingPages;
