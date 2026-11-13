import type { Caja } from '../layout/calcularLayout';

/** La misma curva que `--curva` del reloj: cubic-bezier(0.33, 0, 0.2, 1). */
const DURACION = 620;
const X1 = 0.33;
const X2 = 0.2;
const Y1 = 0;
const Y2 = 1;

export interface Par {
  readonly frasco: Caja;
  readonly nube: Caja;
}

function bezier(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

function derivada(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
}

function curva(x: number): number {
  let t = x;
  for (let i = 0; i < 5; i += 1) {
    const dx = bezier(t, X1, X2) - x;
    const d = derivada(t, X1, X2);
    if (Math.abs(d) < 1e-3) break;
    t = Math.min(1, Math.max(0, t - dx / d));
  }
  return bezier(t, Y1, Y2);
}

function igual(a: Caja, b: Caja): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5
  );
}

function igualPar(a: Par, b: Par): boolean {
  return igual(a.frasco, b.frasco) && igual(a.nube, b.nube);
}

function mezcla(a: Caja, b: Caja, t: number): Caja {
  const u = 1 - t;
  return { x: a.x * u + b.x * t, y: a.y * u + b.y * t, w: a.w * u + b.w * t, h: a.h * u + b.h * t };
}

function en(desde: Par, hasta: Par, now: number, t0: number): Par {
  const t = Math.min(1, Math.max(0, (now - t0) / DURACION));
  const e = t >= 1 ? 1 : curva(t);
  return { frasco: mezcla(desde.frasco, hasta.frasco, e), nube: mezcla(desde.nube, hasta.nube, e) };
}

/** Sigue al sitio nuevo en 620 ms. Si el movimiento está apagado, salta. */
export function crearSuavizado(
  sinMovimiento: () => boolean,
): (now: number, quiere: Par) => { par: Par; sigue: boolean } {
  let desde: Par | null = null;
  let hasta: Par | null = null;
  let t0 = 0;
  return (now, quiere) => {
    if (!desde || !hasta) {
      desde = quiere;
      hasta = quiere;
      return { par: quiere, sigue: false };
    }
    if (!igualPar(hasta, quiere)) {
      desde = en(desde, hasta, now, t0);
      hasta = quiere;
      t0 = now;
      if (sinMovimiento()) {
        desde = quiere;
        hasta = quiere;
        return { par: quiere, sigue: false };
      }
    }
    const par = en(desde, hasta, now, t0);
    const sigue = now - t0 < DURACION && !igualPar(desde, hasta);
    if (!sigue) desde = hasta;
    return { par: sigue ? par : hasta, sigue };
  };
}
