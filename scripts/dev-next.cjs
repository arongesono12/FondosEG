const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const lightningPkgDir = path.join(root, 'node_modules', 'lightningcss', 'pkg');

fs.mkdirSync(lightningPkgDir, { recursive: true });
fs.writeFileSync(
  path.join(lightningPkgDir, 'index.js'),
  "module.exports = require('lightningcss-wasm');\n",
  'utf8'
);

process.env.CSS_TRANSFORMER_WASM = '1';
process.env.NEXT_TEST_WASM = '1';

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '-p', '3001'], {
  cwd: root,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

function writeFiltered(stream, target) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';

    for (const line of lines) {
      if (
        line.includes('Attempted to load @next/swc-win32-x64-msvc') ||
        line.includes('next-swc.win32-x64-msvc.node') ||
        line.includes('experimental.useWasmBinary is not an option') ||
        line.includes('Skipping creating a lockfile')
      ) {
        continue;
      }

      target.write(`${line}\n`);
    }
  });

  stream.on('end', () => {
    if (pending) {
      target.write(pending);
    }
  });
}

writeFiltered(child.stdout, process.stdout);
writeFiltered(child.stderr, process.stderr);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
