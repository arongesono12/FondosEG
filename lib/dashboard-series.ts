/** Punto de los minigráficos de las tarjetas de módulo. */
export interface MetricPoint {
  label: string;
  value: number;
}

const SERIES_DAYS = 7;
const MS_PER_DAY = 86_400_000;
const RANKED_LIMIT = 7;

// Días naturales en UTC, como `dashboard_daily_transfer_stats` y `formatDateShort`.
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortLabel(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${day}/${month}`;
}

/** Suma por día los siete días que acaban en `until`; los días vacíos valen cero. */
export function lastDaysSeries<T>(
  items: readonly T[],
  getDate: (item: T) => string,
  getValue: (item: T) => number,
  until: Date = new Date(),
): MetricPoint[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const date = new Date(getDate(item));
    if (Number.isNaN(date.getTime())) continue;
    const key = utcDayKey(date);
    totals.set(key, (totals.get(key) ?? 0) + getValue(item));
  }

  return Array.from({ length: SERIES_DAYS }, (_, index) => {
    const key = utcDayKey(new Date(until.getTime() - (SERIES_DAYS - 1 - index) * MS_PER_DAY));
    return { label: shortLabel(key), value: totals.get(key) ?? 0 };
  });
}

/** Últimos siete días de una serie diaria ya agregada por el servidor. */
export function dailySeries<T extends { date: string }>(days: readonly T[], getValue: (day: T) => number): MetricPoint[] {
  return days.slice(-SERIES_DAYS).map((day) => ({ label: shortLabel(day.date.slice(0, 10)), value: getValue(day) }));
}

/** Los mayores valores primero, etiquetados con la primera palabra del nombre. */
export function rankedSeries<T>(
  items: readonly T[],
  getName: (item: T) => string,
  getValue: (item: T) => number,
  limit: number = RANKED_LIMIT,
): MetricPoint[] {
  return items
    .map((item) => ({ label: getName(item).trim().split(/\s+/)[0] ?? '', value: getValue(item) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Porcentaje entero de `part` sobre `total`, acotado entre 0 y 100. */
export function shareOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
