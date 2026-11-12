/**
 * Lo que hay que tener en verde antes de un commit de apps/web.
 * Las comprobaciones que hoy fallan sobre 25fca17 no se quitan:
 * se ejecutan y, si fallan por el motivo registrado, la orden sigue.
 * Si una de ellas pasa, hay que quitar la marca en la fase que la arregló.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let codigo = 0;

paso('tipos', 'npx', ['tsc', '--noEmit']);
paso('tests', 'node', ['--test', 'test/*.test.mjs']);
paso('normas', 'node', ['scripts/comprobar-normas.mjs']);
paso('build', 'npm', ['run', 'build']);

const dist = spawnSync(process.execPath, ['scripts/comprobar-dist.mjs'], {
  cwd: raiz,
  encoding: 'utf8',
});
const textoDist = `${dist.stdout ?? ''}${dist.stderr ?? ''}`;
if (dist.status === 0) {
  console.error(
    'INESPERADO: comprobar-dist ha pasado. La causa 1 ya no está; quita la marca en scripts/check.mjs.',
  );
  codigo = 1;
} else {
  console.log(`FALLO ESPERADO [causa 1] scripts/comprobar-dist.mjs\n${textoDist}`);
}

paso('playwright', 'npx', ['playwright', 'test']);

process.exit(codigo);

function paso(nombre, cmd, args) {
  console.log(`\n── ${nombre} ──`);
  const r = spawnSync(cmd, args, { cwd: raiz, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`Ha fallado: ${nombre}`);
    process.exit(r.status ?? 1);
  }
}
