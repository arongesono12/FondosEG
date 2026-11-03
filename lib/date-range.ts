// Trabaja sobre el texto `YYYY-MM-DD` del campo de fecha: pasar por `Date` podría cambiar de día según la zona horaria.
function displayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Texto del botón de un filtro de fechas según los extremos elegidos. */
export function formatDateRangeLabel(from: string, to: string): string {
  if (from && to) return from === to ? displayDate(from) : `${displayDate(from)} – ${displayDate(to)}`;
  if (from) return `Desde ${displayDate(from)}`;
  if (to) return `Hasta ${displayDate(to)}`;
  return 'Fechas';
}
