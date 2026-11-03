import assert from 'node:assert/strict';
import test from 'node:test';
import { dailySeries, lastDaysSeries, rankedSeries, shareOf } from '../../lib/dashboard-series.ts';

test('lastDaysSeries rellena con cero los días sin actividad y acaba en el día de referencia', () => {
  const items = [
    { at: '2026-11-03T09:00:00Z', amount: 100 },
    { at: '2026-11-03T18:00:00Z', amount: 50 },
    { at: '2026-11-01T12:00:00Z', amount: 25 },
  ];

  const series = lastDaysSeries(items, (item) => item.at, (item) => item.amount, new Date('2026-11-03T23:00:00Z'));

  assert.deepEqual(series, [
    { label: '28/10', value: 0 },
    { label: '29/10', value: 0 },
    { label: '30/10', value: 0 },
    { label: '31/10', value: 0 },
    { label: '01/11', value: 25 },
    { label: '02/11', value: 0 },
    { label: '03/11', value: 150 },
  ]);
});

test('lastDaysSeries ignora lo que cae fuera de la ventana y las fechas inválidas', () => {
  const items = [
    { at: '2026-10-27T23:59:59Z' },
    { at: '2026-11-04T00:00:00Z' },
    { at: 'no-es-una-fecha' },
  ];

  const series = lastDaysSeries(items, (item) => item.at, () => 1, new Date('2026-11-03T12:00:00Z'));

  assert.equal(series.reduce((sum, point) => sum + point.value, 0), 0);
});

test('lastDaysSeries no modifica la lista recibida', () => {
  const items = Object.freeze([{ at: '2026-11-03T09:00:00Z' }]);

  assert.doesNotThrow(() => lastDaysSeries(items, (item) => item.at, () => 1, new Date('2026-11-03T12:00:00Z')));
});

test('dailySeries toma los siete últimos días y etiqueta cada uno como dd/mm', () => {
  const days = Array.from({ length: 10 }, (_, index) => ({
    date: `2026-11-${String(index + 1).padStart(2, '0')}`,
    total: index + 1,
  }));

  const series = dailySeries(days, (day) => day.total);

  assert.equal(series.length, 7);
  assert.deepEqual(series[0], { label: '04/11', value: 4 });
  assert.deepEqual(series[6], { label: '10/11', value: 10 });
});

test('rankedSeries ordena de mayor a menor, limita y usa el primer nombre sin alterar el origen', () => {
  const agents = Object.freeze([
    { name: 'Ana López', balance: 10 },
    { name: 'Benito Nsue', balance: 30 },
    { name: 'Carla Obiang', balance: 20 },
  ]);

  const series = rankedSeries(agents, (agent) => agent.name, (agent) => agent.balance, 2);

  assert.deepEqual(series, [
    { label: 'Benito', value: 30 },
    { label: 'Carla', value: 20 },
  ]);
  assert.equal(agents[0].name, 'Ana López');
});

test('shareOf devuelve un porcentaje entero acotado y cero cuando no hay total', () => {
  assert.equal(shareOf(1, 3), 33);
  assert.equal(shareOf(5, 0), 0);
  assert.equal(shareOf(12, 10), 100);
  assert.equal(shareOf(-1, 10), 0);
});
