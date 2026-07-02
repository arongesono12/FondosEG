export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  label: string;
  title: string;
  summary: string;
  effectiveDate: string;
  sections: LegalSection[];
};

export const legalDocuments = {
  terminos: {
    label: 'Condiciones de uso',
    title: 'Términos y condiciones de FondosEG',
    summary: 'Regulan el acceso a la plataforma, las transferencias, billeteras, integraciones API y demás servicios operativos de FondosEG.',
    effectiveDate: '2 de julio de 2026',
    sections: [
      {
        title: '1. Objeto y aceptación',
        paragraphs: [
          'Estos términos constituyen el acuerdo entre la persona física o jurídica que utiliza FondosEG y el operador de la plataforma. Se aplican al sitio web, dashboard, cuentas de usuario, transferencias, billeteras, notificaciones, soporte, APIs, webhooks y funciones relacionadas.',
          'Al registrarte, acceder o autorizar una operación confirmas que has leído y aceptas estas condiciones, la Política de privacidad y la Política de cookies. Si actúas por una empresa, declaras que tienes autoridad suficiente para vincularla.',
        ],
      },
      {
        title: '2. Naturaleza del servicio',
        paragraphs: [
          'FondosEG proporciona infraestructura tecnológica y operativa para registrar, gestionar, consultar y dar seguimiento a movimientos de dinero en francos CFA (XAF), incluidas transferencias de gestores, movimientos entre billeteras, pagos vinculados a alquileres e integraciones con proveedores externos.',
          'La disponibilidad de una función no implica que FondosEG sea por sí mismo una entidad de crédito, entidad de microfinanzas o establecimiento de pago autorizado. Cuando una operación regulada requiera un proveedor habilitado, podrá ser ejecutada por el proveedor financiero o de pagos indicado durante el proceso.',
        ],
      },
      {
        title: '3. Elegibilidad y cuentas',
        bullets: [
          'Debes tener capacidad legal para contratar y facilitar información exacta, actual y verificable.',
          'Las cuentas son personales o están asignadas a una organización; no deben compartirse credenciales ni códigos de verificación.',
          'FondosEG puede asignar roles de cliente, gestor, administrador, superadministrador o developer, cada uno con permisos distintos.',
          'Eres responsable de mantener actualizado tu teléfono, correo, identidad y datos organizativos, y de informar inmediatamente sobre accesos no autorizados.',
        ],
      },
      {
        title: '4. Verificación, cumplimiento y límites',
        paragraphs: [
          'Podemos solicitar nombres, teléfonos, documentos de identidad, información del ordenante y beneficiario, origen o destino de fondos, motivo económico y documentación justificativa. También podemos aplicar límites, revisiones manuales, retenciones o rechazos cuando sean necesarios para seguridad, prevención del fraude, lucha contra el blanqueo, financiación del terrorismo, sanciones o cumplimiento cambiario.',
          'La omisión, falsedad o inconsistencia de información puede producir la suspensión de la operación o de la cuenta y, cuando corresponda, la comunicación a proveedores o autoridades competentes.',
        ],
      },
      {
        title: '5. Órdenes de transferencia',
        bullets: [
          'Antes de confirmar debes revisar importe, moneda, comisión, identidad y teléfono del beneficiario, destino y referencia.',
          'Una orden aceptada puede reservar o debitar saldo. Las transferencias entre billeteras pendientes pueden reservar fondos durante el periodo indicado por la plataforma; actualmente el flujo técnico contempla una expiración de 24 horas.',
          'Una operación pagada, confirmada o liquidada puede ser irreversible. La corrección o cancelación depende de su estado, de la disponibilidad de fondos y de las reglas del proveedor interviniente.',
          'Los códigos, QR y referencias de cobro son confidenciales. Quien los comparte asume el riesgo de que un tercero intente cobrar o confirmar la operación.',
          'Los plazos mostrados son estimaciones y pueden variar por validaciones, disponibilidad del proveedor, incidencias técnicas, festivos o controles regulatorios.',
        ],
      },
      {
        title: '6. Saldos, comisiones y liquidaciones',
        paragraphs: [
          'Los saldos y eventos financieros del dashboard son registros operativos de la plataforma. Las reglas tarifarias vigentes se muestran antes de confirmar cuando corresponda. Nunca debes asumir una comisión distinta de la indicada en la operación o acuerdo comercial aplicable.',
          'Las recargas, ajustes, reservas, devoluciones y liquidaciones pueden requerir conciliación. FondosEG conserva evidencias de saldo anterior y posterior, actor, referencia, fecha y motivo para mantener la trazabilidad.',
        ],
      },
      {
        title: '7. Pagos de alquiler y proveedores externos',
        paragraphs: [
          'Las funciones de propiedades, contratos de alquiler y pagos asociados permiten registrar datos del propietario, inquilino, inmueble, periodo e importe. La ejecución del pago puede depender de una aplicación o proveedor externo. Sus términos, disponibilidad y controles también pueden resultar aplicables.',
          'Los enlaces o pagos gestionados mediante Revolut u otro proveedor están sujetos a la aceptación y reglas de dicho proveedor. FondosEG no controla interrupciones, rechazos o verificaciones impuestas exclusivamente por terceros.',
        ],
      },
      {
        title: '8. APIs, claves y webhooks',
        bullets: [
          'Las claves API, secretos y firmas de webhook son confidenciales y deben almacenarse en sistemas seguros.',
          'El integrador debe aplicar idempotencia, validar firmas, limitar permisos y proteger los datos recibidos.',
          'No está permitido eludir límites, realizar ingeniería inversa, probar credenciales ajenas, introducir código malicioso ni utilizar la API para fines ilícitos.',
          'Podemos rotar o revocar credenciales, limitar solicitudes y suspender una integración que comprometa la seguridad o estabilidad.',
        ],
      },
      {
        title: '9. Uso permitido y obligaciones',
        bullets: [
          'No utilizarás FondosEG para fraude, suplantación, blanqueo, financiación ilícita, evasión de sanciones o comercio prohibido.',
          'No proporcionarás datos de terceros sin base legítima ni enviarás comunicaciones no autorizadas.',
          'Mantendrás fondos suficientes y verificarás la información antes de autorizar operaciones.',
          'Cooperarás con investigaciones de incidencias, reclamaciones, contracargos o verificaciones regulatorias.',
        ],
      },
      {
        title: '10. Disponibilidad, cambios y suspensión',
        paragraphs: [
          'Podemos realizar mantenimiento, corregir errores, modificar funciones o suspender temporalmente accesos por seguridad, cumplimiento, impago, abuso o riesgo operativo. Procuraremos comunicar cambios materiales cuando sea razonablemente posible.',
          'El servicio se presta con la diligencia razonable y no se garantiza disponibilidad ininterrumpida. Esta cláusula no limita derechos imperativos de consumidores ni responsabilidades que legalmente no puedan excluirse.',
        ],
      },
      {
        title: '11. Responsabilidad',
        paragraphs: [
          'Cada usuario responde por instrucciones autorizadas desde su cuenta, datos incorrectos, divulgación de códigos o credenciales y uso contrario a estas condiciones. FondosEG responderá conforme a la normativa aplicable por daños directamente imputables a un incumplimiento probado.',
          'No seremos responsables por hechos fuera de control razonable, actuaciones del beneficiario, indisponibilidad de telecomunicaciones o proveedores, ni por pérdidas indirectas cuando su exclusión sea legalmente válida.',
        ],
      },
      {
        title: '12. Propiedad intelectual',
        paragraphs: ['El software, diseño, marcas, documentación, API y contenidos de FondosEG están protegidos. Se concede únicamente un derecho limitado, revocable, no exclusivo y no transferible para utilizar el servicio conforme a estas condiciones.'],
      },
      {
        title: '13. Reclamaciones y controversias',
        paragraphs: [
          'Puedes presentar una reclamación indicando identidad, teléfono o correo de la cuenta, referencia de operación, descripción y evidencias. La plataforma puede generar una referencia y un plazo objetivo de respuesta; el objetivo operativo actual es de 15 días, sin perjuicio de los plazos legales aplicables.',
          'Intentaremos resolver la controversia de forma amistosa. Cuando proceda, podrás acudir al mecanismo de mediación, autoridad de consumo, BEAC, COBAC, autoridad nacional o tribunal competente conforme al marco aplicable.',
        ],
      },
      {
        title: '14. Legislación y contacto',
        paragraphs: [
          'Estas condiciones se interpretan de acuerdo con las normas imperativas de Guinea Ecuatorial y el marco CEMAC aplicable, incluidos los reglamentos sobre servicios y sistemas de pago, protección del consumidor financiero, prevención del blanqueo y normativa cambiaria.',
          'Consultas y reclamaciones: soporte@fondoseg.com. La identificación societaria, domicilio contractual y datos de licencia del proveedor responsable deben constar en el contrato comercial o documentación de alta aplicable a cada cliente.',
        ],
      },
    ],
  },
  privacidad: {
    label: 'Protección de datos',
    title: 'Política de privacidad de FondosEG',
    summary: 'Explica qué datos trata FondosEG, por qué los utiliza, con quién puede compartirlos y cómo puedes ejercer tus derechos.',
    effectiveDate: '2 de julio de 2026',
    sections: [
      {
        title: '1. Responsable y alcance',
        paragraphs: [
          'Esta política se aplica al landing, registro, dashboard, soporte, APIs, webhooks, transferencias, billeteras, pagos de alquiler y comunicaciones de FondosEG. El responsable contractual es la entidad operadora identificada en el alta o contrato correspondiente.',
          'Para consultas sobre privacidad puedes escribir a soporte@fondoseg.com. Antes del lanzamiento comercial deben completarse en esta página la razón social, domicilio y contacto específico de protección de datos del operador.',
        ],
      },
      {
        title: '2. Datos que recopilamos',
        bullets: [
          'Cuenta e identidad: nombre, correo, teléfono, rol, identificadores internos y datos de autenticación gestionados por Supabase.',
          'Verificación: tipo y número de documento del ordenante o beneficiario, país, ciudad y evidencias solicitadas para cumplimiento.',
          'Operaciones: importes, moneda XAF, comisiones, saldos, reservas, estados, referencias, notas, fechas y participantes de transferencias.',
          'Billeteras y liquidaciones: saldos disponibles o reservados, recargas, ajustes, pagos, reembolsos y eventos contables.',
          'Propiedades y alquileres: inmueble, dirección, propietario, inquilino, teléfono, correo, contrato, periodo, importe y proveedor de pago.',
          'Soporte y comunicaciones: mensajes, reclamaciones, referencias, categoría, resolución, correos recibidos y notificaciones SMS o email.',
          'Integraciones: claves identificadas o previsualizadas, permisos, entornos, uso de API, rutas, códigos de respuesta, webhooks y entregas.',
          'Seguridad y dispositivo: dirección IP, agente de usuario, registros de actividad, incidencias, tiempos de respuesta y metadatos técnicos.',
          'Preferencias: tema claro, oscuro o del sistema y elección sobre almacenamiento opcional.',
        ],
      },
      {
        title: '3. Origen de los datos',
        paragraphs: ['Obtenemos datos directamente del usuario, de su empresa o gestor, de ordenantes y beneficiarios, de integraciones autorizadas, proveedores de pago, servicios de mensajería y correo, y de registros generados automáticamente al utilizar la plataforma. Si aportas datos de un tercero, debes estar autorizado y facilitarle la información correspondiente.'],
      },
      {
        title: '4. Finalidades del tratamiento',
        bullets: [
          'Crear y administrar cuentas, autenticar usuarios y asignar permisos.',
          'Procesar, reservar, confirmar, liquidar, corregir o cancelar operaciones y conciliar saldos.',
          'Identificar ordenantes y beneficiarios y cumplir controles financieros, antifraude, AML/CFT y sanciones.',
          'Enviar códigos, avisos de transferencia, confirmaciones, emails transaccionales y comunicaciones de soporte.',
          'Operar APIs, credenciales, rate limits, idempotencia y webhooks firmados.',
          'Gestionar propiedades, alquileres y pagos cuando estas funciones sean utilizadas.',
          'Atender reclamaciones, mantener evidencias, prevenir abuso, investigar incidentes y defender derechos.',
          'Mantener, diagnosticar y mejorar seguridad, estabilidad y rendimiento.',
        ],
      },
      {
        title: '5. Fundamentos',
        paragraphs: ['Tratamos los datos cuando son necesarios para ejecutar el contrato o instrucciones del usuario, cumplir obligaciones legales y regulatorias, proteger intereses legítimos de seguridad y prevención del fraude, atender reclamaciones o cuando se ha otorgado consentimiento para una finalidad opcional. Cuando el consentimiento sea la base, puede retirarse sin afectar el tratamiento previo.'],
      },
      {
        title: '6. Destinatarios y proveedores',
        bullets: [
          'Supabase, como infraestructura de autenticación y base de datos.',
          'Twilio, cuando se envían SMS operativos o códigos al número facilitado.',
          'Resend y el proveedor de buzón configurado, para correos transaccionales y soporte.',
          'Revolut u otros proveedores de pagos configurados, cuando el usuario solicita una operación que los utiliza.',
          'Clientes de integración y destinos webhook autorizados, limitados a los eventos y datos contratados.',
          'Personal, gestores, administradores, aliados y contrapartes que necesiten información para ejecutar o comprobar una operación.',
          'Autoridades, supervisores, tribunales o asesores cuando exista obligación, requerimiento válido o necesidad de defensa.',
        ],
      },
      {
        title: '7. Transferencias internacionales',
        paragraphs: ['Algunos proveedores tecnológicos pueden tratar datos fuera de Guinea Ecuatorial o de la CEMAC. Antes de habilitarlos en producción, el operador debe verificar ubicación, garantías contractuales, medidas de seguridad y cualquier autorización exigible. Cuando corresponda, se informará al usuario y se aplicarán mecanismos adecuados para la transferencia.'],
      },
      {
        title: '8. Conservación',
        paragraphs: [
          'Conservamos datos de cuenta mientras permanezca activa y durante el plazo necesario para responsabilidades posteriores. Los registros financieros, de cumplimiento, reclamaciones y auditoría se conservan durante los periodos exigidos por la normativa aplicable. Los códigos y verificaciones temporales se mantienen hasta su uso, expiración y un periodo técnico limitado.',
          'Los logs de API, seguridad, notificaciones y webhooks se conservan durante un periodo proporcional a la finalidad operativa y de investigación. Cuando ya no sean necesarios, se eliminan, anonimizan o bloquean, salvo obligación legal de conservación.',
        ],
      },
      {
        title: '9. Seguridad',
        paragraphs: ['La aplicación aplica autenticación, permisos por rol, políticas de seguridad a nivel de fila en la base de datos, secretos y hashes para credenciales, firmas de webhook, idempotencia, registro de actividad y controles de acceso. Ningún sistema es infalible; por ello también se mantienen procedimientos de detección, respuesta y recuperación ante incidentes.'],
      },
      {
        title: '10. Derechos',
        bullets: [
          'Solicitar acceso a tus datos y una explicación del tratamiento.',
          'Rectificar información incorrecta o incompleta.',
          'Solicitar eliminación, limitación u oposición cuando legalmente proceda.',
          'Retirar el consentimiento para tratamientos opcionales.',
          'Solicitar portabilidad cuando sea aplicable y técnicamente posible.',
          'Presentar una reclamación ante la autoridad o tribunal competente.',
        ],
      },
      {
        title: '11. Decisiones automatizadas y menores',
        paragraphs: ['Los controles automáticos pueden señalar riesgo, limitar solicitudes o impedir una operación inválida, pero no se prevé adoptar decisiones exclusivamente automatizadas con efectos jurídicos significativos sin información y garantías adicionales. FondosEG no está dirigido a menores sin capacidad contractual; si detectamos una cuenta creada sin autorización válida, podremos restringirla.'],
      },
      {
        title: '12. Cambios',
        paragraphs: ['Publicaremos actualizaciones cuando cambien las funciones, proveedores o requisitos legales. Si el cambio es material, se comunicará mediante la plataforma o los datos de contacto disponibles. La fecha de vigencia permite identificar la versión aplicable.'],
      },
    ],
  },
  cookies: {
    label: 'Cookies y almacenamiento local',
    title: 'Política de cookies de FondosEG',
    summary: 'Describe las cookies técnicas y el almacenamiento local que utiliza actualmente la aplicación, así como los controles disponibles.',
    effectiveDate: '2 de julio de 2026',
    sections: [
      {
        title: '1. Qué tecnologías utilizamos',
        paragraphs: ['FondosEG utiliza cookies técnicas gestionadas por Supabase para mantener autenticación y renovar sesiones, además de localStorage del navegador para recordar el tema y la elección de consentimiento. Cookie es un término común, pero localStorage funciona de forma diferente y no se envía automáticamente con cada petición.'],
      },
      {
        title: '2. Inventario actual',
        bullets: [
          'Sesión Supabase: cookies esenciales cuyos nombres pueden incluir el identificador del proyecto y fragmentos de sesión. Finalidad: iniciar, mantener y renovar la sesión autenticada. Duración: sesión o la configurada por el servicio de autenticación.',
          'fondoseg-theme: almacenamiento local de preferencia. Guarda light, dark o system para conservar el tema visual. Permanece hasta que el usuario lo cambia o elimina.',
          'fondoseg_cookie_consent_v2:<id-de-usuario>: almacenamiento local de consentimiento. Guarda estado, preferencias y fecha para cada usuario autenticado. Permanece hasta borrado o sustitución por una nueva versión.',
          'Datos técnicos temporales del navegador: el framework puede usar memoria, caché o almacenamiento efímero necesario para navegación y seguridad, sin finalidad publicitaria.',
        ],
      },
      {
        title: '3. Categorías',
        paragraphs: [
          'Las tecnologías esenciales permiten autenticación, seguridad y continuidad de sesión y no pueden desactivarse desde el panel sin impedir funciones principales. Las preferencias recuerdan ajustes visuales y pueden rechazarse desde el banner del dashboard.',
          'La auditoría actual del código no identifica cookies de publicidad, perfiles comerciales ni analítica de terceros. Si se incorporan, esta política y el mecanismo de consentimiento deberán actualizarse antes de activarlas.',
        ],
      },
      {
        title: '4. Gestión del consentimiento',
        paragraphs: ['En el dashboard puedes aceptar todas, rechazar las opcionales o configurar preferencias. La elección se guarda localmente en el dispositivo y navegador utilizados; por eso puede ser necesario repetirla en otro dispositivo o tras borrar datos. Rechazar preferencias no elimina las cookies técnicas necesarias para una sesión solicitada.'],
      },
      {
        title: '5. Cómo borrar o bloquear',
        bullets: [
          'Utiliza la configuración de privacidad del navegador para consultar y eliminar cookies o datos del sitio.',
          'Al bloquear cookies de autenticación puede cerrarse la sesión o dejar de funcionar el dashboard.',
          'Al eliminar fondoseg-theme se volverá a la preferencia del sistema.',
          'Al eliminar el registro de consentimiento, la plataforma podrá volver a solicitar tu elección.',
        ],
      },
      {
        title: '6. Cambios y contacto',
        paragraphs: ['Actualizaremos el inventario si incorporamos nuevas tecnologías, finalidades o proveedores. Para preguntas o para comunicar una inconsistencia entre esta política y el comportamiento del sitio, escribe a soporte@fondoseg.com.'],
      },
    ],
  },
  cumplimiento: {
    label: 'Cumplimiento y seguridad financiera',
    title: 'Marco de cumplimiento de FondosEG',
    summary: 'Resume los controles incorporados a la plataforma y las obligaciones de usuarios, gestores, administradores e integradores.',
    effectiveDate: '2 de julio de 2026',
    sections: [
      {
        title: '1. Marco de referencia',
        paragraphs: [
          'FondosEG ha sido diseñado tomando como referencia el Reglamento n.º 04/18/CEMAC/UMAC/COBAC relativo a los servicios de pago, el Reglamento n.º 03/16 sobre sistemas, medios e incidentes de pago, el Reglamento n.º 01/20 sobre protección de consumidores bancarios, el marco CEMAC de prevención del blanqueo y financiación del terrorismo y la normativa cambiaria aplicable.',
          'Esta declaración describe controles técnicos y operativos observados en la aplicación; no constituye por sí sola una autorización, certificación, auditoría regulatoria ni prueba de licencia. La entidad operadora y los proveedores financieros deben mantener las autorizaciones que correspondan a su actividad.',
        ],
      },
      {
        title: '2. Identificación y conocimiento del cliente',
        bullets: [
          'Registro de nombre, correo, teléfono y rol de cada usuario.',
          'Posibilidad de recopilar tipo y número de documento de ordenante y beneficiario.',
          'Datos de destino, país, ciudad, importe, moneda y notas de la operación.',
          'Verificación adicional cuando el riesgo, importe, canal o proveedor lo requiera.',
          'Restricción o suspensión si los datos son insuficientes, inconsistentes o no verificables.',
        ],
      },
      {
        title: '3. Prevención de blanqueo, fraude y financiación ilícita',
        paragraphs: ['Los usuarios deben explicar el propósito económico y origen de fondos cuando sea requerido. La plataforma puede registrar eventos de cumplimiento, IP, agente de usuario, versión de divulgación y metadatos, y puede someter operaciones a límites, revisión, rechazo o comunicación conforme a la normativa y procedimientos aplicables.'],
        bullets: [
          'No se permiten identidades falsas, fraccionamiento para eludir controles, beneficiarios ficticios ni uso por cuenta de terceros no declarados.',
          'Pueden revisarse patrones de frecuencia, importe, destino, cambios de cuenta, códigos fallidos e inconsistencias documentales.',
          'La confidencialidad legal puede impedir informar sobre determinadas revisiones o comunicaciones a autoridades.',
        ],
      },
      {
        title: '4. Protección del consumidor',
        bullets: [
          'Información previa sobre importe, comisión, moneda, beneficiario y estado de la operación.',
          'Consentimiento expreso antes de ejecutar transferencias sujetas a la divulgación CEMAC configurada.',
          'Historial, referencias y evidencias para comprobar movimientos.',
          'Canal de reclamaciones gratuito con referencia, categoría, acuse y fecha objetivo.',
          'Prohibición de comunicaciones engañosas, tarifas ocultas y cláusulas abusivas.',
        ],
      },
      {
        title: '5. Integridad financiera y trazabilidad',
        paragraphs: ['Las operaciones utilizan funciones transaccionales para bloquear saldos, mantener reservas, evitar duplicados y registrar saldo anterior y posterior. Los eventos financieros, logs de actividad, estados, autores, tiempos y referencias apoyan la conciliación y auditoría. Los mecanismos de idempotencia reducen el riesgo de repetir solicitudes API.'],
      },
      {
        title: '6. Seguridad tecnológica',
        bullets: [
          'Autenticación de usuarios mediante Supabase y cookies técnicas de sesión.',
          'Control por roles y políticas Row Level Security para limitar acceso a registros.',
          'Claves API con permisos, entornos, límites y secretos tratados mediante hash o cifrado según el flujo.',
          'Webhooks firmados, rotación de secretos y registro de intentos de entrega.',
          'Registros de IP, agente de usuario, actividad y solicitudes para investigación.',
          'Separación entre sandbox y producción para integraciones externas.',
        ],
      },
      {
        title: '7. Notificaciones y proveedores',
        paragraphs: ['FondosEG puede utilizar Twilio para SMS, Resend para correo, un buzón IMAP para soporte, Revolut para enlaces o pagos y proveedores configurables para pagos de alquiler. Cada integración debe someterse a evaluación de seguridad, privacidad, continuidad, localización de datos y cumplimiento contractual antes de producción.'],
      },
      {
        title: '8. Incidentes y continuidad',
        paragraphs: ['Los incidentes que afecten confidencialidad, integridad, disponibilidad o ejecución de pagos deben registrarse, contenerse, investigarse y notificarse cuando lo exija la normativa o el contrato. Deben existir copias de seguridad, procedimientos de recuperación, rotación de secretos y mecanismos para revocar accesos comprometidos.'],
      },
      {
        title: '9. Responsabilidades por rol',
        bullets: [
          'Clientes: proteger credenciales, verificar beneficiarios y aportar información legítima.',
          'Gestores: validar identidad y documentación, custodiar fondos y seguir procedimientos de pago y liquidación.',
          'Administradores: aplicar mínimo privilegio, justificar correcciones y recargas y supervisar trazas.',
          'Developers: proteger secretos, validar firmas, limitar datos y respetar rate limits e idempotencia.',
          'Operador: mantener políticas, formación, controles, gestión de proveedores, reclamaciones y revisión periódica de riesgos.',
        ],
      },
      {
        title: '10. Revisión independiente y límites',
        paragraphs: ['Antes de producción comercial, el operador debe completar su matriz regulatoria, confirmar licencias, formalizar responsables, aprobar periodos de conservación, probar respuesta a incidentes y someter controles críticos a revisión jurídica y técnica independiente. La existencia de funciones de cumplimiento en el código no sustituye esos pasos.'],
      },
      {
        title: '11. Fuentes oficiales',
        bullets: [
          'BEAC: Reglamento n.º 04/18/CEMAC/UMAC/COBAC sobre servicios de pago.',
          'BEAC/COBAC: Reglamento n.º 01/20 sobre protección de consumidores de productos y servicios bancarios.',
          'BEAC: Reglamento n.º 03/16 sobre sistemas, medios e incidentes de pago.',
          'BEAC: Reglamento n.º 02/18 relativo a la regulación de cambios en la CEMAC.',
          'Normativa nacional de Guinea Ecuatorial sobre protección de datos, comunicaciones electrónicas y conservación de datos, una vez publicada y confirmada por asesoría local.',
        ],
      },
    ],
  },
} satisfies Record<string, LegalDocument>;
