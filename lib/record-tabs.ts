export interface RecordTabDefinition<T> {
  value: string;
  label: string;
  /** Sin condición, la pestaña muestra todos los elementos. */
  matches?: (item: T) => boolean;
}

export interface RecordTab {
  value: string;
  label: string;
  /** Sin total, la pestaña no pinta contador: la lista se filtra en el servidor. */
  count?: number;
}

export function buildRecordTabs<T>(items: readonly T[], definitions: readonly RecordTabDefinition<T>[]): RecordTab[] {
  return definitions.map(({ value, label, matches }) => ({
    value,
    label,
    count: matches ? items.filter(matches).length : items.length,
  }));
}

export function filterByRecordTab<T>(items: readonly T[], definitions: readonly RecordTabDefinition<T>[], active: string): T[] {
  const matches = definitions.find((definition) => definition.value === active)?.matches;
  return matches ? items.filter(matches) : [...items];
}
