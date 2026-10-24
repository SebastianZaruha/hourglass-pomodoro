#!/usr/bin/env node
/**
 * Revisa los worklets del bundle de Android tal y como los compila Metro
 * (1.8.5). En la web los worklets son funciones normales y ciertos fallos no
 * se ven; en el hilo de la interfaz de Android cierran la app.
 *
 * Regla: los parámetros de un worklet (valores por defecto, desestructuración)
 * no pueden usar variables capturadas de fuera. El plugin de worklets declara
 * esas variables DENTRO del cuerpo (`const [X] = this.__closure`) y los valores
 * por defecto se evalúan antes, en el ámbito de los parámetros: «X is not
 * defined» en el hilo de la interfaz (así se cerraba la 1.8.4 al abrir el menú).
 * Los valores por defecto literales (`n = 10`) sí funcionan.
 *
 * Uso: node scripts/check-worklets.mjs [bundle.js]
 * Sin argumento genera el bundle (sin minificar) en un directorio temporal.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const { parseExpression } = require('@babel/parser');

let bundle = process.argv[2];
if (!bundle) {
  const out = mkdtempSync(join(tmpdir(), 'worklets-'));
  bundle = join(out, 'index.android.js');
  execFileSync(
    'npx',
    [
      'expo',
      'export:embed',
      '--platform',
      'android',
      '--dev',
      'false',
      '--minify',
      'false',
      '--bundle-output',
      bundle,
      '--assets-dest',
      join(out, 'assets'),
    ],
    { cwd: join(root, 'apps', 'mobile'), stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

const src = readFileSync(bundle, 'utf8');
const re = /_worklet_\d+_init_data = \{\s*code: ("(?:[^"\\]|\\.)*")/g;
let count = 0;
const problems = [];
for (const m of src.matchAll(re)) {
  count++;
  const code = JSON.parse(m[1]);
  let fn;
  try {
    fn = parseExpression(code);
  } catch (e) {
    problems.push(`no se puede leer: ${code.slice(0, 80)}… (${e.message})`);
    continue;
  }
  const name = fn.id?.name ?? '(anónimo)';
  const captured = closureNames(fn);
  if (captured.size === 0) continue;
  for (const p of fn.params ?? []) {
    for (const id of references(p)) {
      if (captured.has(id)) {
        problems.push(
          `${name}: el parámetro «${code.slice(p.start, p.end)}» usa «${id}», capturada de fuera`,
        );
      }
    }
  }
}

/** Nombres que el cuerpo saca de `this.__closure`. */
function closureNames(fn) {
  const names = new Set();
  for (const st of fn.body?.body ?? []) {
    if (st.type !== 'VariableDeclaration') continue;
    for (const d of st.declarations) {
      const init = d.init;
      const fromClosure =
        init?.type === 'MemberExpression' &&
        init.object.type === 'ThisExpression' &&
        init.property.name === '__closure';
      if (fromClosure) for (const n of bound(d.id)) names.add(n);
    }
  }
  return names;
}

/** Nombres que declara un patrón. */
function bound(node) {
  if (!node) return [];
  switch (node.type) {
    case 'Identifier':
      return [node.name];
    case 'ArrayPattern':
      return node.elements.flatMap(bound);
    case 'ObjectPattern':
      return node.properties.flatMap((p) => bound(p.type === 'RestElement' ? p.argument : p.value));
    case 'AssignmentPattern':
      return bound(node.left);
    case 'RestElement':
      return bound(node.argument);
    default:
      return [];
  }
}

/** Identificadores que se LEEN en un parámetro (valores por defecto, claves calculadas). */
function references(node) {
  const out = [];
  const walk = (n, isRef) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') {
      if (isRef) out.push(n.name);
      return;
    }
    if (n.type === 'AssignmentPattern') {
      walk(n.left, false);
      walk(n.right, true);
      return;
    }
    if (n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression') {
      walk(n.object, isRef);
      if (n.computed) walk(n.property, isRef);
      return;
    }
    if (n.type === 'ObjectProperty') {
      if (n.computed) walk(n.key, true);
      walk(n.value, isRef);
      return;
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach((c) => walk(c, isRef));
      else if (v && typeof v === 'object') walk(v, isRef);
    }
  };
  walk(node, false);
  return out;
}

if (count === 0) {
  console.error('check-worklets: no hay worklets en el bundle (¿ha cambiado el formato del plugin?)');
  process.exit(1);
}
if (problems.length) {
  console.error(`check-worklets: ${problems.length} problema(s) en ${count} worklets:`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`check-worklets: ${count} worklets revisados, sin problemas.`);
