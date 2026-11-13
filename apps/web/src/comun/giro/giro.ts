import type { FaseGiro } from '../frasco';

/** A partir de aquí el suelte completa el medio giro (180°). */
const FLIP_COMMIT = Math.PI * 0.45;
const FLIP_MS = 1000;
const TURN_MS = 950;

export type OrdenGiro =
  | { tipo: 'agarrar'; anguloPuntero: number }
  | { tipo: 'mover'; anguloPuntero: number }
  | { tipo: 'soltar' }
  | { tipo: 'reiniciar' }
  | { tipo: 'cambioDeFase' };

export interface EstadoGiro {
  angulo: number;
  velocidad: number;
  fase: FaseGiro;
  ocupado: boolean;
}

export interface PoseIntro {
  readonly activa: boolean;
  readonly angulo: number;
  readonly escala: number;
  readonly sombra: number;
}

export type EventoGiro = 'reinicio-sujetar' | 'reinicio-cerrar' | 'fase-cerrar';

export type ResultadoOrden = 'commit' | 'moved' | 'nada';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Único sitio que escribe el ángulo. El arrastre, el muelle, el volteo de
 * 1000 ms, la media vuelta de fase de 950 ms y la intro salen de aquí.
 */
export function crearGiro() {
  let gestureAngle = 0;
  let gestureActive = false;
  let dragOn = false;
  let dragMoved = false;
  let startAng = 0;
  let startRot = 0;

  let flipBusy = false;
  let flipToken = 0;
  let seenToken = 0;
  let flipStart: number | null = null;
  let flipFrom = 0;
  let flipDir = 1;
  let flipHold = false;
  let flipAngle = 0;

  let spin = 0;
  let turnStart: number | null = null;
  let phaseRequest = false;

  let intro: PoseIntro = { activa: false, angulo: 0, escala: 1, sombra: 1 };
  let velocidad = 0;
  let prevAng = 0;
  let last = 0;

  const anguloVisible = (): number => {
    const base = flipStart !== null ? flipAngle : spin + gestureAngle;
    return base + (intro.activa ? intro.angulo : 0);
  };

  const fase = (): FaseGiro => {
    if (flipStart !== null || turnStart !== null) return 'volteo';
    if (gestureActive) return 'arrastre';
    if (Math.abs(gestureAngle) > 0.0008) return 'volviendo';
    return 'reposo';
  };

  const pedirReinicio = () => {
    flipFrom = gestureAngle;
    gestureAngle = 0;
    gestureActive = false;
    dragOn = false;
    flipToken += 1;
  };

  return {
    ocupado: () => flipBusy,
    arrastrando: () => dragOn,
    poseIntro: (): PoseIntro => intro,
    fijarIntro(pose: PoseIntro) {
      intro = pose;
    },
    estado: (): EstadoGiro => ({
      angulo: anguloVisible(),
      velocidad,
      fase: fase(),
      ocupado: flipBusy,
    }),
    ordenar(o: OrdenGiro): ResultadoOrden {
      if (o.tipo === 'agarrar') {
        if (flipBusy) return 'nada';
        dragOn = true;
        startAng = o.anguloPuntero;
        startRot = gestureAngle;
        dragMoved = false;
        gestureActive = true;
        return 'nada';
      }
      if (o.tipo === 'mover') {
        if (!dragOn) return 'nada';
        let delta = o.anguloPuntero - startAng;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        if (Math.abs(delta) > 0.03) dragMoved = true;
        let next = startRot + delta;
        if (next > Math.PI) next = Math.PI;
        if (next < -Math.PI) next = -Math.PI;
        gestureAngle = next;
        return 'nada';
      }
      if (o.tipo === 'soltar') {
        if (!dragOn) return 'nada';
        dragOn = false;
        gestureActive = false;
        const moved = dragMoved;
        if (Math.abs(gestureAngle) >= FLIP_COMMIT) {
          pedirReinicio();
          return 'commit';
        }
        return moved ? 'moved' : 'nada';
      }
      if (o.tipo === 'reiniciar') {
        if (flipBusy) return 'nada';
        pedirReinicio();
        return 'commit';
      }
      phaseRequest = true;
      return 'nada';
    },
    /** El puntero se cancela: no hay volteo. El muelle devuelve el ángulo. */
    interrumpir() {
      dragOn = false;
      gestureActive = false;
    },
    /**
     * Un fotograma, en el mismo orden que el motor publicado:
     * el giro pedido, el muelle ×0,84 y las dos animaciones.
     */
    avanzar(now: number, reducir: boolean): EventoGiro[] {
      const events: EventoGiro[] = [];

      if (flipToken !== seenToken) {
        seenToken = flipToken;
        gestureActive = false;
        dragOn = false;
        if (reducir) {
          gestureAngle = 0;
          flipBusy = false;
        } else {
          flipBusy = true;
          flipStart = now;
          flipDir = flipFrom < 0 ? -1 : 1;
          gestureAngle = 0;
        }
      }

      if (!flipBusy && !gestureActive && Math.abs(gestureAngle) > 0.0008) {
        gestureAngle *= 0.84;
        if (Math.abs(gestureAngle) < 0.004) gestureAngle = 0;
      }

      if (flipStart !== null) {
        const t = Math.min(1, (now - flipStart) / FLIP_MS);
        const dest = flipDir * Math.PI;
        if (t < 1) {
          flipAngle = flipFrom + (dest - flipFrom) * easeInOutCubic(t);
        } else if (!flipHold) {
          flipHold = true;
          flipAngle = dest;
          events.push('reinicio-sujetar');
        } else {
          flipStart = null;
          flipHold = false;
          spin = 0;
          flipAngle = 0;
          flipBusy = false;
          gestureAngle = 0;
          events.push('reinicio-cerrar');
        }
      }

      if (phaseRequest) {
        phaseRequest = false;
        if (!reducir && turnStart === null) turnStart = now;
      }
      if (turnStart !== null) {
        const t = Math.min(1, (now - turnStart) / TURN_MS);
        if (t < 1) spin = Math.PI * easeInOutCubic(t);
        else {
          spin = 0;
          turnStart = null;
          events.push('fase-cerrar');
        }
      }

      const angulo = anguloVisible();
      const dt = last > 0 ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      velocidad = dt > 0 ? (angulo - prevAng) / dt : 0;
      prevAng = angulo;
      last = now;
      return events;
    },
  };
}

export type MaquinaGiro = ReturnType<typeof crearGiro>;
