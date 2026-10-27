import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  APPLICATION_ICON_BUCKET,
  APPLICATION_ICON_MAX_BYTES,
  buildApplicationIconPath,
  detectApplicationIconType,
  ownedIconStoragePath,
} from '../../lib/server/application-icon-rules.ts';

const root = new URL('../../', import.meta.url);
const load = (path: string) => readFile(new URL(path, root), 'utf8');
const APP = '11111111-1111-4111-8111-111111111111';
const OTHER_APP = '22222222-2222-4222-8222-222222222222';
const ORIGIN = 'https://demo.supabase.co';
const STORAGE = `${ORIGIN}/storage/v1/object/public`;

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

test('reconoce PNG, JPEG y WebP por su contenido, no por la extensión', () => {
  assert.deepEqual(detectApplicationIconType(PNG), { mime: 'image/png', extension: 'png' });
  assert.deepEqual(detectApplicationIconType(JPEG), { mime: 'image/jpeg', extension: 'jpg' });
  assert.deepEqual(detectApplicationIconType(WEBP), { mime: 'image/webp', extension: 'webp' });
});

test('rechaza SVG, HTML y ficheros truncados', () => {
  const encode = (text: string) => new TextEncoder().encode(text);
  assert.equal(detectApplicationIconType(encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')), null);
  assert.equal(detectApplicationIconType(encode('<html><script>alert(1)</script></html>')), null);
  assert.equal(detectApplicationIconType(PNG.slice(0, 4)), null);
  // RIFF que no es WebP (p. ej. un WAV).
  assert.equal(detectApplicationIconType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])), null);
});

test('el límite de tamaño es el mismo que declara el bucket', async () => {
  const migration = await load('supabase/migrations/20261027_api_application_icons.sql');
  assert.match(migration, new RegExp(`'${APPLICATION_ICON_BUCKET}'`));
  assert.match(migration, new RegExp(`\\b${APPLICATION_ICON_MAX_BYTES}\\b`));
  assert.doesNotMatch(migration, /image\/svg/);
});

test('cada icono vive en la carpeta de su aplicación con nombre único', () => {
  const path = buildApplicationIconPath(APP, 'png', 'abc123');
  assert.equal(path, `${APP}/abc123.png`);
  assert.throws(() => buildApplicationIconPath('../otra', 'png', 'abc123'));
  assert.throws(() => buildApplicationIconPath(APP, 'png', '../../x'));
});

test('solo se borra un icono antiguo si es de la misma aplicación', () => {
  const own = `${STORAGE}/${APPLICATION_ICON_BUCKET}/${APP}/abc123.png`;
  assert.equal(ownedIconStoragePath(own, APP, ORIGIN), `${APP}/abc123.png`);
  assert.equal(ownedIconStoragePath(`${STORAGE}/${APPLICATION_ICON_BUCKET}/${OTHER_APP}/abc123.png`, APP, ORIGIN), null);
  assert.equal(ownedIconStoragePath(`${STORAGE}/avatars/${APP}/abc123.png`, APP, ORIGIN), null);
  assert.equal(ownedIconStoragePath(`${STORAGE}/${APPLICATION_ICON_BUCKET}/${APP}/../${OTHER_APP}/x.png`, APP, ORIGIN), null);
  assert.equal(ownedIconStoragePath(null, APP, ORIGIN), null);
  assert.equal(ownedIconStoragePath('no es una url', APP, ORIGIN), null);
});

test('un icon_url de otro dominio nunca borra objetos del bucket propio', () => {
  const foreign = `https://evil.example/${APPLICATION_ICON_BUCKET}/${APP}/abc123.png`;
  assert.equal(ownedIconStoragePath(foreign, APP, ORIGIN), null);
  // Sin origen de Supabase configurado no se borra nada.
  assert.equal(ownedIconStoragePath(`${STORAGE}/${APPLICATION_ICON_BUCKET}/${APP}/abc123.png`, APP, null), null);
});

test('el bucket no se puede listar con la clave anónima', async () => {
  const migration = await load('supabase/migrations/20261027_api_application_icons.sql');
  assert.doesNotMatch(migration, /CREATE POLICY/i);
});

test('la ruta del icono exige ser gestor de la aplicación', async () => {
  const route = await load('app/api/applications/[id]/icon/route.ts');
  assert.match(route, /requireVisibleApplication\(/);
  assert.match(route, /detectApplicationIconType\(/);
  assert.match(route, /APPLICATION_ICON_MAX_BYTES/);
});
