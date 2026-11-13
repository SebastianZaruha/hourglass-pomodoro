/**
 * Stylelint, la regla ESLint de las normas y un rg.
 * El código de 25fca17 las incumple. El registro normas/fallos-conocidos.txt
 * lista esos fallos. Si aparece uno nuevo, o desaparece uno, esta orden falla:
 * quitar una línea del registro es una decisión, no un efecto colateral.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registro = path.join(raiz, 'normas', 'fallos-conocidos.txt');
const escribir = process.argv.includes('--escribir');

const fallos = [...stylelint(), ...eslintNormas(), ...busquedaTema()];
fallos.sort();

if (escribir) {
  mkdirSync(path.dirname(registro), { recursive: true });
  const cabecera = [
    '# Fallos esperados de las normas N1, N4, N5 y N8 sobre el commit 25fca17.',
    '# No se debilitan: si la lista cambia, hay que actualizarla a propósito.',
    ...fallos,
    '',
  ].join('\n');
  writeFileSync(registro, cabecera);
  console.log(`Registro escrito con ${fallos.length} fallos.`);
  process.exit(0);
}

if (!existsSync(registro)) {
  console.error('Falta normas/fallos-conocidos.txt. Genera uno con --escribir.');
  process.exit(1);
}

const conocidos = readFileSync(registro, 'utf8')
  .split('\n')
  .map((linea) => linea.trim())
  .filter((linea) => linea && !linea.startsWith('#'));

const actuales = new Set(fallos);
const viejos = new Set(conocidos);
const nuevos = fallos.filter((linea) => !viejos.has(linea));
const resueltos = conocidos.filter((linea) => !actuales.has(linea));

if (nuevos.length === 0 && resueltos.length === 0) {
  console.log(`FALLO ESPERADO [normas]: ${fallos.length} incumplimientos, los mismos del registro.`);
  process.exit(0);
}

if (nuevos.length) {
  console.error(`Normas nuevas (${nuevos.length}), no están en el registro:`);
  for (const linea of nuevos.slice(0, 40)) console.error(`  + ${linea}`);
}
if (resueltos.length) {
  console.error(`Normas que ya no fallan (${resueltos.length}). Actualiza el registro a propósito:`);
  for (const linea of resueltos.slice(0, 40)) console.error(`  - ${linea}`);
}
process.exit(1);

function leerJson(resultado, nombre) {
  const candidatos = [resultado.stdout ?? '', resultado.stderr ?? ''];
  for (const texto of candidatos) {
    const inicio = texto.indexOf('[');
    if (inicio < 0) continue;
    try {
      return JSON.parse(texto.slice(inicio));
    } catch {
      // El otro canal puede ser el que trae el JSON.
    }
  }
  console.error(resultado.stderr || `${nombre} no ha devuelto JSON.`);
  process.exit(1);
}

function stylelint() {
  const r = spawnSync(
    'npx',
    [
      'stylelint',
      'src/**/*.css',
      'public/**/*.css',
      '--formatter',
      'json',
      '--config',
      'stylelint.config.mjs',
    ],
    { cwd: raiz, encoding: 'utf8' },
  );
  const json = leerJson(r, 'stylelint');
  const lineas = [];
  for (const archivo of json) {
    const rel = path.relative(raiz, archivo.source);
    for (const aviso of archivo.warnings ?? []) {
      lineas.push(`stylelint ${rel}:${aviso.line} ${aviso.rule}`);
    }
  }
  return lineas;
}

function eslintNormas() {
  const r = spawnSync('npx', ['eslint', '-c', 'eslint.normas.mjs', 'src', '-f', 'json'], {
    cwd: raiz,
    encoding: 'utf8',
  });
  const json = leerJson(r, 'eslint');
  const lineas = [];
  for (const archivo of json) {
    const rel = path.relative(raiz, archivo.filePath);
    for (const aviso of archivo.messages ?? []) {
      if (!aviso.ruleId) continue;
      lineas.push(`eslint ${rel}:${aviso.line} ${aviso.ruleId}`);
    }
  }
  return lineas;
}

function busquedaTema() {
  const r = spawnSync(
    'rg',
    [
      '-n',
      '-t',
      'ts',
      '--glob',
      '!**/temas/**',
      '--glob',
      '!**/estilo/**',
      '-e',
      "activo !== 'lluvia'",
      '-e',
      "!== 'arena'",
      '-e',
      "=== 'lluvia'",
      '-e',
      "=== 'clasico'",
      '-e',
      "=== 'miel'",
      '-e',
      "=== 'nieve'",
      '-e',
      'dark \\?',
      'src',
    ],
    { cwd: raiz, encoding: 'utf8' },
  );
  if (r.status !== 0 && r.status !== 1) {
    console.error(r.stderr || 'rg no ha podido buscar comparaciones de tema.');
    process.exit(1);
  }
  return (r.stdout || '')
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => `rg ${linea}`);
}
