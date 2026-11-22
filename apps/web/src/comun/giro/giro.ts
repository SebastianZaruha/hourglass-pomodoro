import type { FaseGiro } from '../frasco';

/** Media vuelta del reinicio. El frasco gira este tiempo y después se llena el contenido. */
export const MS_MEDIA_VUELTA = 600;
/**
 * Revelado del contenido nuevo, al quedar el frasco de pie. Ease-in-out.
 * Solo máscara: no mueve granos ni pasa nada por el cuello.
 */
export const MS_LLENADO = 350;
/**
 * Vuelta al soltar. Ease-out de un solo frasco, siempre el mismo.
 * No hay fundido del vidrio: si el montón no puede caer, se cruza solo el contenido.
 */
export const MS_VUELTA_SOLTAR = 360;
const FLIP_MS = MS_MEDIA_VUELTA;
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
  /** El doble clic es reinicio. El cambio de fase del reloj es fase. */
  vuelta: 'no' | 'reinicio' | 'fase';
}

export interface PoseIntro {
  readonly activa: boolean;
  readonly angulo: number;
  readonly escala: number;
  readonly sombra: number;
  /** 0..1: 1 centrado en la ventana, 0 en su sitio. Lo usa el frasco 3D (el 2D va con --intro-x/y). */
  readonly centrado?: number;
  /** 0..1: opacidad del vidrio. Lo usa el frasco 3D (el 2D va con --intro-glass). */
  readonly opacidad?: number;
}

export type EventoGiro = 'reinicio-sujetar' | 'reinicio-cerrar' | 'fase-cerrar';

export type ResultadoOrden = 'commit' | 'moved' | 'nada';

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Único sitio que escribe el ángulo. El arrastre, el muelle, el volteo de
 * 900 ms, la media vuelta de fase de 950 ms y la intro salen de aquí.
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
  let vueltaT0: number | null = null;
  let vueltaDesde = 0;
  let quieto = false;
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

  const vuelta = (): 'no' | 'reinicio' | 'fase' => {
    if (flipStart !== null) return 'reinicio';
    if (turnStart !== null) return 'fase';
    return 'no';
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
    enPausa(valor: boolean) {
      quieto = valor;
      if (!valor || !dragOn) return;
      dragOn = false;
      gestureActive = false;
    },
    poseIntro: (): PoseIntro => intro,
    fijarIntro(pose: PoseIntro) {
      intro = pose;
    },
    estado: (): EstadoGiro => ({
      angulo: anguloVisible(),
      velocidad,
      fase: fase(),
      ocupado: flipBusy,
      vuelta: vuelta(),
    }),
    ordenar(o: OrdenGiro): ResultadoOrden {
      if (o.tipo === 'agarrar') {
        if (flipBusy) return 'nada';
        if (quieto) {
          dragOn = true;
          dragMoved = false;
          gestureActive = false;
          startAng = o.anguloPuntero;
          startRot = gestureAngle;
          return 'nada';
        }
        dragOn = true;
        startAng = o.anguloPuntero;
        startRot = gestureAngle;
        dragMoved = false;
        gestureActive = true;
        return 'nada';
      }
      if (o.tipo === 'mover') {
        if (!dragOn) return 'nada';
        if (quieto) {
          let delta = o.anguloPuntero - startAng;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          if (Math.abs(delta) > 0.03) dragMoved = true;
          return 'nada';
        }
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
        // Soltar no reinicia, ni a 170°. El muelle devuelve el ángulo a 0.
        // El medio giro solo lo pide el doble clic.
        if (!dragOn) return 'nada';
        dragOn = false;
        gestureActive = false;
        const moved = dragMoved;
        dragMoved = false;
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
     * el giro pedido, la vuelta a cero y las dos animaciones.
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

      // Un solo ángulo, el del mismo frasco. Ease-out cúbico: sale y se posa.
      // Antes la duración crecía con el ángulo (hasta ~440 ms a 150°) y el
      // cubo gastaba casi todo el giro en los primeros fotogramas. En esos
      // mismos fotogramas la arena se resimulaba con la gravedad ya vertical,
      // así que el montón inclinado desaparecía y aparecía otro de pie.
      if (gestureActive || flipBusy || flipStart !== null) {
        vueltaT0 = null;
      } else if (Math.abs(gestureAngle) > 1e-5) {
        if (vueltaT0 === null) {
          vueltaT0 = now;
          vueltaDesde = gestureAngle;
        }
        const t = Math.min(1, (now - vueltaT0) / MS_VUELTA_SOLTAR);
        const queda = (1 - t) * (1 - t) * (1 - t);
        gestureAngle = t >= 1 ? 0 : vueltaDesde * queda;
      } else {
        gestureAngle = 0;
        vueltaT0 = null;
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
