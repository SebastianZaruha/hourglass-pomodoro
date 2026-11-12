import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

const carpeta = path.resolve(import.meta.dirname, 'punto-de-partida');
const salida = path.resolve(import.meta.dirname, 'salida');

/**
 * Escribe el motivo de cada fallo esperado y el índice de capturas.
 * Las referencias definitivas no se tocan: esto es el punto de partida.
 */
export default class Informe implements Reporter {
  private readonly lineas: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (test.expectedStatus !== 'failed') return;
    const texto = result.errors.map((error) => error.message ?? error.stack ?? '').join('\n');
    const marca = result.status === 'unexpected' ? 'INESPERADO (ya no falla)' : 'FALLO ESPERADO';
    const bloque = `\n${marca}: ${test.titlePath().join(' › ')}\n${texto}\n`;
    this.lineas.push(bloque);
    console.log(bloque);
  }

  onEnd(result: FullResult): void {
    mkdirSync(salida, { recursive: true });
    mkdirSync(carpeta, { recursive: true });
    const archivo = path.join(salida, 'fallos-esperados.log');
    writeFileSync(archivo, this.lineas.join('\n'), 'utf8');
    const fotos = listar(carpeta).filter((nombre) => nombre.endsWith('.png'));
    const indice = [
      '# Punto de partida (commit 25fca17)',
      '',
      'Capturas del build de producción antes de arreglar nada.',
      'No son referencias: las referencias viven en `__referencias__` y solo las aprueba Sebastián.',
      '',
      `Estado de la suite: ${result.status}.`,
      '',
      ...fotos.map((nombre) => `- \`${nombre}\``),
      '',
    ].join('\n');
    writeFileSync(path.join(carpeta, 'INDICE.md'), indice, 'utf8');
  }
}

function listar(dir: string, prefijo = ''): string[] {
  let entradas: string[] = [];
  try {
    entradas = readdirSync(dir);
  } catch {
    return [];
  }
  const rutas: string[] = [];
  for (const entrada of entradas.sort()) {
    const absoluto = path.join(dir, entrada);
    const relativo = prefijo ? `${prefijo}/${entrada}` : entrada;
    if (statSync(absoluto).isDirectory()) rutas.push(...listar(absoluto, relativo));
    else rutas.push(relativo);
  }
  return rutas;
}
