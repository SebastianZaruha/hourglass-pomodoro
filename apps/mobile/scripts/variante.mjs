#!/usr/bin/env node
/**
 * Arranca un comando con APP_VARIANT. Los binarios del workspace van delante
 * en el PATH para que `expo` resuelva igual que un script de npm.
 *
 *   node ./scripts/variante.mjs development expo start
 *   node ./scripts/variante.mjs production node ../../scripts/build-apk.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [variante, ...cmd] = process.argv.slice(2);
if ((variante !== 'development' && variante !== 'production') || cmd.length === 0) {
  console.error('uso: variante.mjs <development|production> <comando> [args...]');
  process.exit(1);
}

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(mobile, '../..');
const env = { ...process.env, APP_VARIANT: variante };
env.PATH = [
  path.join(mobile, 'node_modules', '.bin'),
  path.join(root, 'node_modules', '.bin'),
  env.PATH ?? '',
].join(path.delimiter);

const child = spawn(cmd[0], cmd.slice(1), {
  stdio: 'inherit',
  env,
  // En Windows el binario de npm es expo.cmd; hace falta el shell para encontrarlo.
  shell: process.platform === 'win32',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
