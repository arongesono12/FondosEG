import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function load(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

test('el historial busca y pagina en el servidor, no sobre una muestra cargada', async () => {
  const [page, route] = await Promise.all([
    load('app/(dashboard)/history/page.tsx'),
    load('app/api/transfers/history/route.ts'),
  ]);

  // La página ya no descarga un lote fijo para filtrarlo en el navegador.
  assert.doesNotMatch(page, /getAllTransfers\(150\)|getTransfers\(150\)/);
  assert.match(page, /getTransferHistory\(/);
  assert.match(page, /cursor: nextCursor/);

  // Cursor estable por (created_at, id), con el mismo orden en ambas fuentes.
  assert.match(route, /\.order\('created_at', \{ ascending: false \}\)\s*\.order\('id', \{ ascending: false \}\)/);
  assert.match(route, /created_at\.lt\."\$\{createdAt\}",and\(created_at\.eq\."\$\{createdAt\}",id\.lt\.\$\{id\}\)/);
});

test('el historial conserva el alcance por usuario y no expone el código de billetera', async () => {
  const route = await load('app/api/transfers/history/route.ts');

  assert.match(route, /agent_id\.eq\.\$\{profile\.id\},paid_out_by\.eq\.\$\{profile\.id\}/);
  assert.match(route, /sender_id\.eq\.\$\{profile\.id\},receiver_user_id\.eq\.\$\{profile\.id\}/);
  assert.match(route, /sender_id\.eq\.\$\{profile\.id\},receiver_id\.eq\.\$\{profile\.id\}/);

  const walletColumns = route.match(/const WALLET_COLUMNS = '([^']+)'/)?.[1];
  assert.ok(walletColumns, 'la consulta de billetera debe declarar columnas explícitas');
  assert.doesNotMatch(walletColumns, /verification_code|\*/);
  // El código tampoco sirve como criterio de búsqueda (sería un oráculo).
  assert.doesNotMatch(route, /SEARCH_COLUMNS = \[[^\]]*verification_code/);
});

test('las cifras del dashboard no convierten un error en cero', async () => {
  const page = await load('app/(dashboard)/dashboard/page.tsx');

  assert.doesNotMatch(page, /Promise\.all\(/, 'un fallo de una consulta no debe descartar las demás');
  assert.match(page, /useRemoteBlock\(/);
  assert.match(page, /stats \? fmt\(amount \?\? 0\) : '—'/);
});
