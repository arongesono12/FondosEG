import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecordTabs, filterByRecordTab, type RecordTabDefinition } from '../../lib/record-tabs.ts';

type Item = { id: string; active: boolean };

const items: readonly Item[] = Object.freeze([
  { id: 'a', active: true },
  { id: 'b', active: false },
  { id: 'c', active: true },
]);

const definitions: readonly RecordTabDefinition<Item>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos', matches: (item) => item.active },
];

test('buildRecordTabs cuenta los elementos de cada pestaña', () => {
  assert.deepEqual(buildRecordTabs(items, definitions), [
    { value: 'all', label: 'Todos', count: 3 },
    { value: 'active', label: 'Activos', count: 2 },
  ]);
});

test('filterByRecordTab deja solo lo que coincide con la pestaña activa', () => {
  assert.deepEqual(filterByRecordTab(items, definitions, 'active').map((item) => item.id), ['a', 'c']);
});

test('filterByRecordTab devuelve todo en una pestaña sin condición', () => {
  assert.equal(filterByRecordTab(items, definitions, 'all').length, 3);
});

test('filterByRecordTab devuelve todo si la pestaña no existe', () => {
  assert.equal(filterByRecordTab(items, definitions, 'desconocida').length, 3);
});
