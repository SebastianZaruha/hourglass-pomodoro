/**
 * Menos partículas y sin ondas cuando un fotograma no cabe.
 *
 * La fluidez manda. El usuario no elige un «modo rendimiento»: si el
 * fotograma de JavaScript se alarga, el chorro se adelgaza solo y, en la
 * lluvia, las ondas se quedan quietas. Cuando vuelve a sobrar tiempo, se
 * recupera despacio para que no parpadee.
 *
 * No mira solo el hueco entre fotogramas: un móvil de 60 Hz va a ~16 ms
 * aunque le sobre CPU, y no hay que castigarlo. Se baja de calidad si el
 * propio JavaScript no cabe en un fotograma de 120 Hz (9,5 ms) o, peor,
 * de 60 Hz (14 ms), o si el hueco real se dispara Y el JavaScript ya iba
 * justo (la GPU o el hilo de interfaz no llegan).
 *
 * La arena en reposo no pasa por aquí: el bucle está parado.
 */

export type DetailLevel = 'alta' | 'media' | 'baja';

export interface DetailClock {
  level: DetailLevel;
  /** Fotogramas caros seguidos. */
  slow: number;
  /** Fotogramas holgados seguidos. */
  fast: number;
}

export interface DetailSample {
  /** Lo que tardó el fotograma en el hilo de JavaScript, en ms. */
  readonly jsMs: number;
  /** Hueco hasta el fotograma anterior, en ms (lo marca el refresco de la pantalla). */
  readonly gapMs: number;
}

const DROP_FRAMES = 4;
const RISE_FRAMES = 48;

export function freshDetail(): DetailClock {
  return { level: 'alta', slow: 0, fast: 0 };
}

/** Actualiza `clock` en el sitio (el bucle no reserva un objeto por fotograma). */
export function updateDetail(clock: DetailClock, sample: DetailSample): void {
  const js = sample.jsMs;
  const gap = sample.gapMs;
  if (!Number.isFinite(js) || !Number.isFinite(gap)) return;

  const heavy = js >= 14;
  const tight = js >= 9.5;
  const missed = gap >= 20 && js >= 7;

  if (heavy || (missed && clock.level !== 'alta')) {
    clock.fast = 0;
    clock.slow += 1;
    if (clock.slow >= DROP_FRAMES) {
      clock.level = 'baja';
      clock.slow = 0;
    }
    return;
  }
  if (tight || missed) {
    clock.fast = 0;
    clock.slow += 1;
    if (clock.slow >= DROP_FRAMES && clock.level === 'alta') {
      clock.level = 'media';
      clock.slow = 0;
    }
    return;
  }
  // Holgado a 120 Hz: se puede recuperar del todo.
  if (js <= 5.5 && gap <= 12) {
    clock.slow = 0;
    clock.fast += 1;
    if (clock.fast >= RISE_FRAMES && clock.level !== 'alta') {
      clock.level = clock.level === 'baja' ? 'media' : 'alta';
      clock.fast = 0;
    }
    return;
  }
  // Estable a 60 Hz: de baja se vuelve a media, no del tirón a alta.
  if (js <= 8 && gap <= 18) {
    clock.slow = 0;
    clock.fast += 1;
    if (clock.fast >= RISE_FRAMES && clock.level === 'baja') {
      clock.level = 'media';
      clock.fast = 0;
    }
    return;
  }
  clock.slow = 0;
  clock.fast = 0;
}

/** Multiplicador del chorro. 1 = todas las partículas. */
export function streamDetail(level: DetailLevel): number {
  if (level === 'baja') return 0.35;
  if (level === 'media') return 0.62;
  return 1;
}

/** Las ondas de la lluvia solo en calidad alta (son un seno por píxel). */
export function wavesAllowed(level: DetailLevel): boolean {
  return level === 'alta';
}

/** Cuántas rayas y copos dibujar. 1 = todos. */
export function shapeBudget(level: DetailLevel): { ribbons: number; puffs: number; waves: boolean } {
  if (level === 'baja') return { ribbons: 0.4, puffs: 0.55, waves: false };
  if (level === 'media') return { ribbons: 0.7, puffs: 0.8, waves: false };
  return { ribbons: 1, puffs: 1, waves: true };
}
