import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function load(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

/** Bloques de declaraciones sin llaves anidadas, con su selector. */
function declarationBlocks(css: string): Array<{ selector: string; body: string }> {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Array<{ selector: string; body: string }> = [];
  for (const match of source.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    blocks.push({ selector: match[1].trim(), body: match[2] });
  }
  return blocks;
}

test('ninguna regla declara a la vez `translate` y `transform`', async () => {
  // Lightning CSS, que Tailwind sólo ejecuta en `next build`, funde
  // `translate` dentro de `transform` y lo descarta: la regla se comporta
  // distinto en desarrollo y en producción.
  const styles = (await readdir(new URL('app/styles/', root)))
    .filter((file) => file.endsWith('.css'))
    .map((file) => `app/styles/${file}`);

  for (const file of ['app/globals.css', ...styles]) {
    for (const { selector, body } of declarationBlocks(await load(file))) {
      if (/^(from|to|\d+%)/.test(selector)) continue;
      const hasTranslate = /(^|[;\s])translate\s*:/.test(body);
      const hasTransform = /(^|[;\s])transform\s*:/.test(body);
      assert.ok(!(hasTranslate && hasTransform), `${file}: «${selector}» declara translate y transform`);
    }
  }
});

