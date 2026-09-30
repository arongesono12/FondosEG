import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function load(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

test('los modales secundarios del shell no viajan en la carga inicial', async () => {
  const shell = await load('components/layout/dashboard-layout-wrapper.tsx');

  for (const [name, file] of [
    ['UsersPanel', 'users-panel'],
    ['SearchModal', 'search-modal'],
    ['SettingsModal', 'settings-modal'],
    ['SupportModal', 'support-modal'],
    ['CookieConsentModal', 'cookie-consent-modal'],
  ]) {
    assert.doesNotMatch(shell, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from '\\./${file}'`), `${name} se importa de forma estática`);
    assert.match(shell, new RegExp(`const ${name} = dynamic\\(\\(\\) => import\\('\\./${file}'\\)`));
  }
});

test('el sondeo del shell se detiene con la pestaña oculta', async () => {
  const shell = await load('components/layout/dashboard-layout-wrapper.tsx');

  assert.doesNotMatch(shell, /setInterval\(/, 'un setInterval sigue pidiendo datos con la pestaña oculta');
  assert.match(shell, /document\.visibilityState !== 'visible'/);
  assert.match(shell, /addEventListener\('visibilitychange'/);
});

test('el dashboard no carga Recharts para barras de un solo valor', async () => {
  const page = await load('app/(dashboard)/dashboard/page.tsx');

  assert.doesNotMatch(page, /from 'recharts'/);
  assert.match(page, /role="meter"/);
});
