// Read-only repository census. Run: node docs/audit-source-metrics.mjs
import fs from 'node:fs';
import cp from 'node:child_process';
const files = cp.execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const rows = [];
const frontLib = new Set(['store', 'canvas-utils', 'clerk-appearance', 'design-tokens', 'marketing-content', 'legal-content']);
const backServices = new Set(['client', 'sms', 'wallet-transfer', 'withdrawal']);
for (const file of files) {
  if (!/\.(tsx?|[cm]?js|css|sql)$/.test(file) || file.includes('/dist/') || file.startsWith('docs/') || file.startsWith('.agents/') || file.startsWith('.codex/')) continue;
  const base = file.split('/').pop().replace(/\.[^.]+$/, '');
  let group;
  if (file.startsWith('tests/')) group = 'Tests';
  else if (file.startsWith('sdk/')) group = 'SDK';
  else if (file.startsWith('supabase/')) group = 'Backend SQL/Edge';
  else if (/^(app\/(api|actions)\/|lib\/(server|security)\/|shared\/)/.test(file) || file === 'proxy.ts' || ['lib/api-auth.ts', 'lib/email-service.ts', 'lib/supabase/admin.ts'].includes(file) || (file.startsWith('services/') && backServices.has(base)) || /modules\/.*\/application\//.test(file)) group = 'Backend TS';
  else if (/^(app\/|components\/|services\/)/.test(file) || (file.startsWith('lib/') && frontLib.has(base)) || /modules\/.*\/http\//.test(file)) group = 'Frontend';
  else if (/^(lib\/|types\/)/.test(file)) group = 'Shared';
  else group = 'Tooling';
  const source = fs.readFileSync(file, 'utf8');
  rows.push({ file, group, lines: source.split(/\r?\n/).filter(line => line.trim()).length, bytes: Buffer.byteLength(source), client: /^['"]use client['"];?/m.test(source) });
}
const totals = {};
for (const row of rows) {
  const total = totals[row.group] ??= { files: 0, lines: 0, bytes: 0 };
  total.files++; total.lines += row.lines; total.bytes += row.bytes;
}
const uiPages = rows.filter(r => r.file.startsWith('app/') && r.file.endsWith('/page.tsx'));
const dashboardPages = uiPages.filter(r => r.file.startsWith('app/(dashboard)/'));
const output = {
  method: 'Tracked source files; nonblank physical lines including comments; excludes generated SDK dist, dependencies, assets, JSON, documentation and skill code. SSR presentation files count as frontend by responsibility, not execution location.',
  commit: cp.execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
  totals,
  pages: { total: uiPages.length, client: uiPages.filter(r => r.client).length, dashboard: dashboardPages.length, dashboardClient: dashboardPages.filter(r => r.client).length },
  apiRoutes: rows.filter(r => r.file.startsWith('app/api/') && r.file.endsWith('/route.ts')).length,
  css: { files: rows.filter(r => r.file.endsWith('.css')).length, lines: rows.filter(r => r.file.endsWith('.css')).reduce((sum, r) => sum + r.lines, 0) },
  largest: rows.filter(r => r.group === 'Frontend').sort((a, b) => b.lines - a.lines).slice(0, 12),
  rows
};
console.log(JSON.stringify(output, null, 2));
