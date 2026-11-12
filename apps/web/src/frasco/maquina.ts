import { pasoMuelle } from './muelle';

/** 45 % de media vuelta: a partir de aquí el suelte completa el volteo. */
export const UMBRAL_VOLTEO = Math.PI * 0.45;

export type FaseFrasco = 'reposo' | 'arrastrando' | 'volteando';

export interface EstadoFrasco {
  readonly fase: FaseFrasco;
  readonly angulo: number;
  readonly velocidad: number;
  readonly objetivo: number;
}

export function estadoInicial(): EstadoFrasco {
  return { fase: 'reposo', angulo: 0, velocidad: 0, objetivo: 0 };
}

export type OrdenFrasco =
  | { readonly tipo: 'arrastrar'; readonly angulo: number; readonly dt: number }
  | { readonly tipo: 'soltar'; readonly reducir: boolean }
  | { readonly tipo: 'quieto'; readonly dt: number; readonly reducir: boolean };

export interface PasoFrasco {
  readonly estado: EstadoFrasco;
  readonly volteoCompletado: boolean;
}

function limitar(angulo: number): number {
  return Math.min(Math.PI, Math.max(-Math.PI, angulo));
}

function signo(valor: number): number {
  return valor < 0 ? -1 : 1;
}

/**
 * Dueña del ángulo. El gesto propone; solo esta función lo escribe.
 * Al cruzar 180° el ángulo vuelve a 0 en el mismo paso: el canje de
 * bulbos lo hace quien pinta, y los dos fotogramas coinciden.
 */
export function pasoFrasco(estado: EstadoFrasco, orden: OrdenFrasco): PasoFrasco {
  if (orden.tipo === 'arrastrar') {
    const angulo = limitar(orden.angulo);
    const dt = Math.max(1 / 240, orden.dt);
    return {
      estado: {
        fase: 'arrastrando',
        angulo,
        velocidad: (angulo - estado.angulo) / dt,
        objetivo: angulo,
      },
      volteoCompletado: false,
    };
  }

  if (orden.tipo === 'soltar') {
    const comprometer = Math.abs(estado.angulo) >= UMBRAL_VOLTEO;
    if (orden.reducir && comprometer) {
      return { estado: estadoInicial(), volteoCompletado: true };
    }
    const objetivo = comprometer ? signo(estado.angulo) * Math.PI : 0;
    return {
      estado: { ...estado, fase: 'volteando', objetivo },
      volteoCompletado: false,
    };
  }

  if (estado.fase === 'arrastrando') {
    return { estado, volteoCompletado: false };
  }

  if (estado.fase === 'reposo' && estado.angulo === 0 && estado.velocidad === 0) {
    return { estado, volteoCompletado: false };
  }

  const siguiente = pasoMuelle(
    { valor: estado.angulo, velocidad: estado.velocidad },
    estado.objetivo,
    orden.dt,
    64,
    20,
  );
  const cruzo =
    estado.objetivo !== 0 && (estado.angulo - estado.objetivo) * (siguiente.valor - estado.objetivo) <= 0;
  if (cruzo || (estado.objetivo !== 0 && siguiente.valor === estado.objetivo)) {
    return { estado: estadoInicial(), volteoCompletado: true };
  }
  const llego = siguiente.velocidad === 0 && siguiente.valor === estado.objetivo;
  return {
    estado: {
      fase: llego ? 'reposo' : 'volteando',
      angulo: siguiente.valor,
      velocidad: siguiente.velocidad,
      objetivo: llego ? 0 : estado.objetivo,
    },
    volteoCompletado: false,
  };
}

/** Giro de 180° de un punto. Sirve para comprobar que el canje no salta. */
export function puntoEnPantalla(angulo: number, x: number, y: number): { x: number; y: number } {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * El fotograma boca abajo, con el contenido aún en su sitio, es el mismo
 * que el fotograma derecho tras canjear los bulbos (x, y) → (−x, −y).
 */
export function continuidadVolteo(
  x: number,
  y: number,
): {
  antes: { x: number; y: number };
  despues: { x: number; y: number };
} {
  return {
    antes: puntoEnPantalla(Math.PI, x, y),
    despues: puntoEnPantalla(0, -x, -y),
  };
}
