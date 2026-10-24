/**
 * Reglas para las funciones del core que corren en el hilo de la interfaz
 * (directiva 'worklet'). En la web los worklets son funciones normales y
 * estos fallos no se ven; en Android (Hermes, release) cierran la app.
 *
 * 1.8.4: `glassFade(openness, fullAt = GLASS_FULL_AT)` cerraba la app al abrir
 * el menú: el plugin de worklets declara las constantes capturadas dentro del
 * cuerpo y el valor por defecto del parámetro no las ve.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

type Fn = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration;

function isWorklet(fn: Fn): boolean {
  const body = fn.body;
  if (!body || !ts.isBlock(body)) return false;
  const first = body.statements[0];
  return (
    !!first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'worklet'
  );
}

function worklets(file: string): { name: string; fn: Fn; sf: ts.SourceFile }[] {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: { name: string; fn: Fn; sf: ts.SourceFile }[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      isWorklet(node)
    ) {
      const name = (node as ts.FunctionDeclaration).name?.getText(sf) ?? '(anónima)';
      out.push({ name: `${file.slice(SRC.length + 1)}:${name}`, fn: node, sf });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const all = files(SRC).flatMap(worklets);

describe('worklets del core', () => {
  it('hay worklets que revisar', () => {
    expect(all.map((w) => w.name)).toEqual(
      expect.arrayContaining(['menu/glassFade.ts:glassFade', 'menu/pixel.ts:snapToPixel']),
    );
  });

  it('ningún parámetro tiene valor por defecto ni desestructuración', () => {
    const bad = all.flatMap(({ name, fn, sf }) =>
      fn.parameters
        .filter((p) => p.initializer || !ts.isIdentifier(p.name))
        .map((p) => `${name}: ${p.getText(sf)}`),
    );
    expect(bad).toEqual([]);
  });

  it('solo llaman a otros worklets del core o a Math/Number', () => {
    const names = new Set(all.map((w) => w.name.split(':')[1]));
    const exported = new Set<string>();
    for (const f of files(SRC)) {
      const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
      sf.forEachChild((n) => {
        if (ts.isFunctionDeclaration(n) && n.name) exported.add(n.name.text);
      });
    }
    const bad: string[] = [];
    for (const { name, fn, sf } of all) {
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const callee = node.expression.text;
          if (exported.has(callee) && !names.has(callee)) bad.push(`${name} → ${callee}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(fn);
      void sf;
    }
    expect(bad).toEqual([]);
  });
});
