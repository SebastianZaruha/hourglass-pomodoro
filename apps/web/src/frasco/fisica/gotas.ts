/** Hilo vertical en el mundo. La semilla es fija: cada gota lleva su velocidad. */

const GRADOS = (35 * Math.PI) / 180;
const CORTE_MS = 200;

export interface Gota {
  readonly largo: number;
  readonly velocidad: number;
  readonly opacidad: number;
  readonly fase: number;
}

function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function crearGotas(n = 6, semilla = 11): Gota[] {
  const rnd = aleatorio(semilla);
  const gotas: Gota[] = [];
  for (let i = 0; i < n; i++) {
    gotas.push({
      largo: 6 + rnd() * 8,
      velocidad: 90 + rnd() * 140,
      opacidad: 0.35 + rnd() * 0.25,
      fase: rnd(),
    });
  }
  return gotas;
}

export const GOTAS = crearGotas();

export function cercaDeLaVertical(angulo: number): boolean {
  const a = Math.abs(angulo) % Math.PI;
  return Math.min(a, Math.PI - a) < GRADOS;
}

export function pasoGotas(alpha: number, activo: boolean, dt: number): number {
  if (activo) return 1;
  return Math.max(0, alpha - dt / (CORTE_MS / 1000));
}
