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
| Indicadores agrupados | Radio solo en las esquinas superiores, base recta |
| Relleno normal | 20 px; 18 px en móvil |
| Indicador compacto | 20 px; 16 px en móvil; sin icono decorativo |

Los gráficos conservan series distinguibles con rosa, sus tintes y grises.
Las etiquetas escritas siguen identificando los estados y las categorías.

## Uso

- Tarjetas de contenido: `Card`, `CardHeader`, `CardTitle`, `CardDescription`,
  `CardContent` y `CardFooter`, desde `components/ui/card.tsx`.
- Indicadores: `DashboardMetric`, desde
  `components/dashboard/dashboard-metric.tsx`. Conserva `label`, `value` y
  `hint`; no necesita icono ni color individual.
- Rejilla de indicadores: añadir `dashboard-metric-group` a la rejilla
  existente y conservar sus columnas adaptables al contenedor.
- Resúmenes, listas y tarjetas interiores: `dashboard-inset`. Esta clase
  incluye sus propios colores para que también funcione en contenido portaleado.
- Tarjetas de acción: conservar un enlace o botón como elemento interactivo,
  con sus estados de foco. Los indicadores usan `interactive={false}`.

Los estilos viven en `app/styles/dashboard-system.css` y están limitados a la
aplicación autenticada y a las superficies marcadas expresamente. Los hooks de
`Card` y `Badge` no cambian por sí solos el diseño de marketing o autenticación.
