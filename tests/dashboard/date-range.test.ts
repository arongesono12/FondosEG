import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDateRangeLabel } from '../../lib/date-range.ts';

test('formatDateRangeLabel usa el nombre del filtro cuando no hay fechas', () => {
  assert.equal(formatDateRangeLabel('', ''), 'Fechas');
});

test('formatDateRangeLabel indica el extremo cuando solo hay una fecha', () => {
  assert.equal(formatDateRangeLabel('2026-10-12', ''), 'Desde 12/10/2026');
  assert.equal(formatDateRangeLabel('', '2026-10-29'), 'Hasta 29/10/2026');
});

test('formatDateRangeLabel muestra el rango con las dos fechas', () => {
  assert.equal(formatDateRangeLabel('2026-10-12', '2026-10-29'), '12/10/2026 – 29/10/2026');
});

test('formatDateRangeLabel muestra una sola fecha cuando el rango es de un día', () => {
  assert.equal(formatDateRangeLabel('2026-10-12', '2026-10-12'), '12/10/2026');
});
