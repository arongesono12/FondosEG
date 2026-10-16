/**
 * Next.js ejecuta `register()` una vez al arrancar el servidor y compila este
 * archivo tanto para el runtime `nodejs` como para `edge`.
 *
 * El `import()` debe ir DENTRO del `if`: webpack sustituye NEXT_RUNTIME por una
 * constante y descarta la rama muerta, pero no el código que sigue a un
 * `return`. Si el import quedara fuera, el bundle edge intentaría resolver
 * `crypto` (que no existe allí) y el build fallaría con "Can't resolve 'crypto'".
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
