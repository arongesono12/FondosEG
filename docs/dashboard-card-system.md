# Tarjetas de la aplicación

La referencia visual es el dashboard: `DashboardOverview`, su bandeja de
operaciones y la franja de indicadores. Las pantallas completas y los módulos
abiertos en panel lateral comparten el mismo sistema.

## Revisión y alcance

Se revisaron Envíos, Gestores, Saldos, Estadísticas, Historial, Administración,
Perfil, Cumplimiento y el portal de desarrolladores. Las diferencias encontradas
eran indicadores duplicados con iconos decorativos, fondos de colores en los
resúmenes, radios distintos y paneles interiores sin un estilo compartido.

La unificación conserva los datos, las rutas, los permisos, los formularios,
las acciones, las etiquetas de estado y el apilado de tablas en móvil.

## Reglas compartidas

| Elemento | Regla |
| --- | --- |
| Fondo principal | `--dashboard-ink`, `#0f172a` |
| Superficie interior | Blanco al 9% sobre la tinta |
| Borde | Blanco al 14,5%, 1 px, sin sombra |
| Texto | Blanco; blanco al 80% para el texto secundario |
| Acento | `--primary`, el rosa del dashboard |
| Tarjeta de contenido | Radio de 26 px; 20 px en móvil |
| Tarjeta interior | Radio de 20 px |
| Tarjeta de indicador | Altura mínima de 242 px; visual anclado al borde inferior |
| Relleno normal | 20 px; 18 px en móvil |
| Indicador compacto | 20 px; 16 px en móvil; sin icono decorativo |

Los gráficos conservan series distinguibles con rosa, sus tintes y grises.
Las etiquetas escritas siguen identificando los estados y las categorías.

Estadísticas usa dos gráficos propios (`components/dashboard/stats-charts.tsx`):
barras diarias con conmutador de serie y un anillo de un único porcentaje. El
arco del anillo siempre sale del dato, y el desglose queda debajo en filas.

## Uso

- Tarjetas de contenido: `Card`, `CardHeader`, `CardTitle`, `CardDescription`,
  `CardContent` y `CardFooter`, desde `components/ui/card.tsx`.
- Indicadores de módulo: las cuatro tarjetas del dashboard, desde
  `components/dashboard/module-metric-card.tsx`. Cada módulo las agrupa en
  `ModuleMetrics` y usa `MetricCard` con un visual inferior: `MetricDesk`,
  `MetricBars`, `MetricArea`, `MetricRate` o `MetricTiles`. Las series salen de
  `lib/dashboard-series.ts` y siempre usan datos reales del módulo. Mientras
  carga, `ModuleMetricsSkeleton` reserva el mismo espacio.
- Rejilla de indicadores: `.overview-metrics` pasa de cuatro a dos columnas y a
  una según el ancho del contenedor, además del de la ventana.
- Indicadores de la bandeja del dashboard: `DashboardMetric`, desde
  `components/dashboard/dashboard-metric.tsx`. Conserva `label`, `value` y
  `hint`; no necesita icono ni color individual.
- Listas de registros de un módulo: la tarjeta «Operaciones recientes» del
  dashboard, con `RecordPanel` desde `components/dashboard/record-panel.tsx`:
  pestañas arriba, lista seleccionable a la izquierda y detalle a la derecha. El
  detalle se compone con `RecordDetailHeading`, `RecordDetailTiles` y
  `RecordDetailFooter`. Las pestañas locales salen de `lib/record-tabs.ts`.
  `TransferRecordPanel` es la variante para operaciones, y los paneles de cada
  dominio viven en `components/dashboard/panels/`. Los formularios en modal, los
  gráficos y los bloques sin registros seleccionables no usan esta tarjeta.
- Esquina de la tarjeta: `corner` admite un enlace, `ExpandableSearch` o filtros.
  `cornerRow` indica a partir de qué ancho baja a su propia fila: `phone` con
  una búsqueda, `laptop` con búsqueda y filtros.
- Resúmenes, listas y tarjetas interiores: `dashboard-inset`. Esta clase
  incluye sus propios colores para que también funcione en contenido portaleado.
- Tarjetas de acción: conservar un enlace o botón como elemento interactivo,
  con sus estados de foco. Los indicadores usan `interactive={false}`.

Los estilos viven en `app/styles/dashboard-system.css` y están limitados a la
aplicación autenticada y a las superficies marcadas expresamente. Los hooks de
`Card` y `Badge` no cambian por sí solos el diseño de marketing o autenticación.
