import { nivelDeDuracion } from './nivel';

/** 1,8 Hz. El vaivén cruza la horizontal y se apaga en menos de un segundo. */
const OMEGA = 11.3;
const ZETA = 0.3;
/** Empuje extra por la aceleración angular, como en la web. */
const KAPPA = 0.35;
/** Muestras de la ola a lo ancho del bulbo. En la web son 32. */
export const OLAS = 8;
const C_ANCHO = 0.9;
const BETA = 2.4;
const EPSILON = 0.08;
const TOPE_OLA = 0.04;
const PASO = 1 / 60;
/** El volumen alcanza al temporizador sin un salto. */
const CONSTANTE_VOLUMEN = 0.6;
/** Por debajo de esto el muelle ya está quieto. */
const PHI_QUIETO = (0.2 * Math.PI) / 180;
const PHI_VEL_QUIETA = 0.02;
const OLA_QUIETA = 0.1;
const TOPE_PHI = 0.9;
/** Revelado del agua nueva, al quedar el frasco de pie. Copiado de la web, no importado. */
export const MS_LLENADO = 350;
/** A partir de aquí las gotas se apagan. */
export const THETA_GOTAS = (35 * Math.PI) / 180;
const BISECCIONES = 12;

export interface PuntoPlano {
  readonly x: number;
  readonly y: number;
}

export interface EntradaAgua {
  readonly dt: number;
  readonly ahora: number;
  /** atan2(gx, gy). 0 es el móvil de pie. */
  readonly theta: number;
  readonly durationMs: number;
  readonly remainingMs: number;
  readonly corriendo: boolean;
  readonly pausa: boolean;
  /** Giro de fase: el agua va pegada al vidrio. */
  readonly enGiro: boolean;
  /** Reinicio del temporizador: llena de abajo arriba. */
  readonly reposo: boolean;
}

export interface LineaAgua {
  dibujar: boolean;
  /** El agua es la proyección >= h. */
  h: number;
  s0: number;
  s1: number;
  /** Altura del bulbo en la proyección, para el velo. */
  rango: number;
  /** Extremos de la línea, donde toca el cristal. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  readonly onda: Float64Array;
}

export interface VistaAgua {
  alfa: number;
  phi: number;
  theta: number;
  arriba: LineaAgua;
  abajo: LineaAgua;
  volArriba: number;
  volAbajo: number;
  /** 0..1 mientras sube el agua del reinicio. null si no. */
  llenado: number | null;
  sigue: boolean;
  cortarGotas: boolean;
}

export interface ModeloAgua {
  fijarContorno(arriba: readonly PuntoPlano[], abajo: readonly PuntoPlano[]): void;
  paso(e: EntradaAgua): VistaAgua;
  /** `fase` y el volteo del móvil intercambian los bulbos. */
  alVoltear(motivo: 'reinicio' | 'fase'): void;
  destruir(): void;
}

interface Contorno {
  x: Float64Array;
  y: Float64Array;
  n: number;
  area: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function linea(onda: Float64Array): LineaAgua {
  return { dibujar: false, h: 0, s0: 0, s1: 0, rango: 1, x0: 0, y0: 0, x1: 0, y1: 0, onda };
}

function copiarContorno(pts: readonly PuntoPlano[]): Contorno {
  const n = pts.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = pts[i]!.x;
    y[i] = pts[i]!.y;
  }
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += x[i]! * y[j]! - x[j]! * y[i]!;
  }
  return { x, y, n, area: Math.abs(a) * 0.5 };
}

/** Se rellena en cada llamada. Quien lo use tiene que copiar los números al momento. */
const volumen = { arriba: 0, abajo: 0 };

function objetivos(durationMs: number, remainingMs: number): { arriba: number; abajo: number } {
  const nivel = nivelDeDuracion(durationMs);
  const resto = durationMs > 0 ? Math.min(1, Math.max(0, remainingMs / durationMs)) : 0;
  volumen.arriba = nivel * resto;
  volumen.abajo = 1 - nivel * resto;
  return volumen;
}

/** Altura de la ola en la coordenada s de la superficie. */
export function muestraOla(onda: Float64Array, s: number, s0: number, s1: number): number {
  const ancho = s1 - s0;
  if (!(ancho > 1)) return 0;
  const f = Math.min(1, Math.max(0, (s - s0) / ancho)) * (OLAS - 1);
  const i = Math.min(OLAS - 2, Math.floor(f));
  const fr = f - i;
  return (onda[i] ?? 0) * (1 - fr) + (onda[i + 1] ?? 0) * fr;
}

/**
 * Agua del móvil. La superficie queda horizontal en el mundo:
 * en el marco del frasco su ángulo es θ + φ.
 * θ = atan2(gx, gy) apunta al lado bajo (la arena cae hacia ahí).
 * φ es un muelle alrededor de esa horizontal. La altura sale por bisección.
 */
export function crearModeloAgua(): ModeloAgua {
  let muerto = false;
  let arriba: Contorno | null = null;
  let abajo: Contorno | null = null;
  let volArriba = 0;
  let volAbajo = 0;
  let iniciado = false;
  let phi = 0;
  let phiV = 0;
  let prevTheta = 0;
  let prevVel = 0;
  let saltar = true;
  let llenadoT0: number | null = null;
  /** Ya estamos parados (ajuste de duración). El siguiente reposo no es un reinicio. */
  let enReposo = false;
  const yA = new Float64Array(OLAS);
  const vA = new Float64Array(OLAS);
  const yB = new Float64Array(OLAS);
  const vB = new Float64Array(OLAS);
  const vista: VistaAgua = {
    alfa: 0,
    phi: 0,
    theta: 0,
    arriba: linea(yA),
    abajo: linea(yB),
    volArriba: 0,
    volAbajo: 0,
    llenado: null,
    sigue: false,
    cortarGotas: false,
  };
  // Caché de la bisección: no se repite si el ángulo y el nivel no se han movido.
  const cacheA = { alfa: Number.NaN, frac: Number.NaN };
  const cacheB = { alfa: Number.NaN, frac: Number.NaN };
  const clipX = new Float64Array(512);
  const clipY = new Float64Array(512);

  const intercambiar = () => {
    const tmp = volArriba;
    volArriba = volAbajo;
    volAbajo = tmp;
    for (let i = 0; i < OLAS; i++) {
      const y = yA[i] ?? 0;
      const v = vA[i] ?? 0;
      yA[i] = -(yB[i] ?? 0);
      vA[i] = -(vB[i] ?? 0);
      yB[i] = -y;
      vB[i] = -v;
    }
    phi = -phi;
    phiV = -phiV;
    saltar = true;
    cacheA.alfa = Number.NaN;
    cacheB.alfa = Number.NaN;
  };

  const integrarOla = (
    y: Float64Array,
    v: Float64Array,
    s0: number,
    s1: number,
    altoBulbo: number,
    dt: number,
    velocidad: number,
  ) => {
    const ancho = Math.max(1, s1 - s0);
    const dx = ancho / (OLAS - 1);
    const c2 = (C_ANCHO * ancho) ** 2;
    const medio = (s0 + s1) / 2;
    const tope = TOPE_OLA * altoBulbo;
    for (let i = 0; i < OLAS; i++) {
      const izq = i === 0 ? (y[1] ?? 0) : (y[i - 1] ?? 0);
      const der = i === OLAS - 1 ? (y[OLAS - 2] ?? 0) : (y[i + 1] ?? 0);
      const centro = y[i] ?? 0;
      const lap = (izq - 2 * centro + der) / (dx * dx);
      v[i] = (v[i] ?? 0) + (c2 * lap - BETA * (v[i] ?? 0)) * dt;
    }
    for (let i = 0; i < OLAS; i++) {
      const s = s0 + (i / (OLAS - 1)) * ancho;
      v[i] = (v[i] ?? 0) + EPSILON * velocidad * (s - medio) * dt;
    }
    for (let i = 0; i < OLAS; i++) y[i] = (y[i] ?? 0) + (v[i] ?? 0) * dt;
    let media = 0;
    for (let i = 0; i < OLAS; i++) media += y[i] ?? 0;
    media /= OLAS;
    for (let i = 0; i < OLAS; i++) {
      const valor = (y[i] ?? 0) - media;
      y[i] = valor > tope ? tope : valor < -tope ? -tope : valor;
    }
    media = 0;
    for (let i = 0; i < OLAS; i++) media += y[i] ?? 0;
    media /= OLAS;
    for (let i = 0; i < OLAS; i++) y[i] = (y[i] ?? 0) - media;
  };

  const areaProy = (c: Contorno, sen: number, cos: number, h: number): number => {
    const { x, y, n } = c;
    let m = 0;
    const dentro = (i: number) => x[i]! * sen + y[i]! * cos >= h;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const di = dentro(i);
      const dj = dentro(j);
      if (di) {
        clipX[m] = x[i]!;
        clipY[m] = y[i]!;
        m += 1;
      }
      if (di !== dj) {
        const pa = x[i]! * sen + y[i]! * cos;
        const pb = x[j]! * sen + y[j]! * cos;
        const t = (h - pa) / (pb - pa || 1e-9);
        clipX[m] = x[i]! + (x[j]! - x[i]!) * t;
        clipY[m] = y[i]! + (y[j]! - y[i]!) * t;
        m += 1;
      }
    }
    if (m < 3) return 0;
    let a = 0;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      a += clipX[i]! * clipY[j]! - clipX[j]! * clipY[i]!;
    }
    return Math.abs(a) * 0.5;
  };

  const extremos = (c: Contorno, sen: number, cos: number) => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < c.n; i++) {
      const p = c.x[i]! * sen + c.y[i]! * cos;
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { min, max };
  };

  const contactos = (c: Contorno, sen: number, cos: number, h: number, sup: LineaAgua) => {
    const { x, y, n } = c;
    let s0 = Infinity;
    let s1 = -Infinity;
    let puesto = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pa = x[i]! * sen + y[i]! * cos;
      const pb = x[j]! * sen + y[j]! * cos;
      if ((pa - h) * (pb - h) > 0) continue;
      const t = (h - pa) / (pb - pa || 1e-9);
      if (t < -0.001 || t > 1.001) continue;
      const px = x[i]! + (x[j]! - x[i]!) * t;
      const py = y[i]! + (y[j]! - y[i]!) * t;
      const s = px * cos - py * sen;
      if (!puesto || s < s0) {
        sup.x0 = px;
        sup.y0 = py;
        s0 = s;
      }
      if (!puesto || s > s1) {
        sup.x1 = px;
        sup.y1 = py;
        s1 = s;
      }
      puesto = true;
    }
    if (!puesto) {
      sup.s0 = 0;
      sup.s1 = 1;
      return;
    }
    sup.s0 = s0;
    sup.s1 = s1 === s0 ? s0 + 1 : s1;
  };

  const preparar = (
    c: Contorno | null,
    fraccion: number,
    alfa: number,
    sup: LineaAgua,
    cache: { alfa: number; frac: number },
  ) => {
    if (!c || c.n < 4 || c.area < 1 || fraccion <= 0.004) {
      sup.dibujar = false;
      cache.alfa = Number.NaN;
      return;
    }
    if (sup.dibujar && Math.abs(alfa - cache.alfa) < 5e-4 && Math.abs(fraccion - cache.frac) < 5e-4) return;
    const sen = Math.sin(alfa);
    const cos = Math.cos(alfa);
    const ext = extremos(c, sen, cos);
    sup.rango = Math.max(1, ext.max - ext.min);
    if (fraccion >= 0.996) {
      sup.dibujar = true;
      sup.h = ext.min - 1;
      contactos(c, sen, cos, (ext.min + ext.max) / 2, sup);
    } else {
      let lo = ext.min;
      let hi = ext.max;
      const meta = fraccion * c.area;
      for (let k = 0; k < BISECCIONES; k++) {
        const mid = (lo + hi) / 2;
        const a = areaProy(c, sen, cos, mid);
        if (a > meta) lo = mid;
        else hi = mid;
      }
      sup.dibujar = true;
      sup.h = (lo + hi) / 2;
      contactos(c, sen, cos, sup.h, sup);
    }
    cache.alfa = alfa;
    cache.frac = fraccion;
  };

  const olasQuietas = (y: Float64Array, v: Float64Array) => {
    for (let i = 0; i < OLAS; i++) {
      if (Math.abs(y[i] ?? 0) > OLA_QUIETA || Math.abs(v[i] ?? 0) > OLA_QUIETA) return false;
    }
    return true;
  };

  return {
    fijarContorno(ptsArriba, ptsAbajo) {
      arriba = copiarContorno(ptsArriba);
      abajo = copiarContorno(ptsAbajo);
      cacheA.alfa = Number.NaN;
      cacheB.alfa = Number.NaN;
    },
    destruir() {
      muerto = true;
      arriba = null;
      abajo = null;
    },
    alVoltear(motivo) {
      if (muerto) return;
      // El volteo del móvil y el fin de fase son media vuelta: se cambian los bulbos.
      // El llenado del reinicio lo pide el temporizador con `reposo`, no este motivo.
      void motivo;
      intercambiar();
    },
    paso(e) {
      if (muerto) {
        vista.sigue = false;
        return vista;
      }
      const congelada = e.pausa || e.enGiro;
      if (e.reposo) {
        const obj = objetivos(e.durationMs, e.remainingMs);
        volArriba = obj.arriba;
        volAbajo = obj.abajo;
        iniciado = true;
        if (enReposo) {
          // El dedo sigue eligiendo el tiempo: el volumen cambia de golpe.
          // Sin esto cada escalón vacía los bulbos 350 ms y mata las olas.
          llenadoT0 = null;
          vista.llenado = null;
        } else {
          phi = 0;
          phiV = 0;
          yA.fill(0);
          vA.fill(0);
          yB.fill(0);
          vB.fill(0);
          prevTheta = e.theta;
          prevVel = 0;
          saltar = true;
          llenadoT0 = e.ahora;
          vista.llenado = 0;
          cacheA.alfa = Number.NaN;
          cacheB.alfa = Number.NaN;
        }
        enReposo = true;
      } else if (e.corriendo || e.pausa) {
        enReposo = false;
      }
      vista.theta = e.theta;
      if (!congelada && !e.reposo) {
        const dt = Math.min(0.1, Math.max(0, e.dt));
        const obj = objetivos(e.durationMs, e.remainingMs);
        if (!iniciado) {
          volArriba = obj.arriba;
          volAbajo = obj.abajo;
          iniciado = true;
          prevTheta = e.theta;
          saltar = true;
        }
        let llenando = false;
        if (llenadoT0 !== null) {
          const t = Math.min(1, Math.max(0, (e.ahora - llenadoT0) / MS_LLENADO));
          if (t >= 1) {
            llenadoT0 = null;
            vista.llenado = null;
          } else {
            llenando = true;
            vista.llenado = easeInOutCubic(t);
          }
        }
        if (!llenando) {
          const k = 1 - Math.exp(-dt / CONSTANTE_VOLUMEN);
          volArriba += (obj.arriba - volArriba) * k;
          volAbajo += (obj.abajo - volAbajo) * k;
        }
        const dTheta = e.theta - prevTheta;
        // vel es la velocidad de la horizontal en pantalla. El golpe a φ
        // la compensa un instante, y el muelle la trae de vuelta.
        const vel = dt > 0 ? dTheta / dt : 0;
        const acc = !saltar && dt > 0 ? (vel - prevVel) / dt : 0;
        if (!saltar) phi -= dTheta;
        saltar = false;
        prevTheta = e.theta;
        prevVel = vel;
        let queda = dt;
        while (queda > 1e-4) {
          const paso = Math.min(PASO, queda);
          queda -= paso;
          const a = -OMEGA * OMEGA * phi - 2 * ZETA * OMEGA * phiV - KAPPA * acc;
          phiV += a * paso;
          phi += phiV * paso;
        }
        if (phi > TOPE_PHI) {
          phi = TOPE_PHI;
          if (phiV > 0) phiV = 0;
        } else if (phi < -TOPE_PHI) {
          phi = -TOPE_PHI;
          if (phiV < 0) phiV = 0;
        }
        const alfa = e.theta + phi;
        const muestraA = vista.arriba.dibujar ? vista.arriba : null;
        const s0A = muestraA ? muestraA.s0 : -1;
        const s1A = muestraA ? muestraA.s1 : 1;
        const s0B = vista.abajo.dibujar ? vista.abajo.s0 : -1;
        const s1B = vista.abajo.dibujar ? vista.abajo.s1 : 1;
        const rangoA = vista.arriba.rango;
        const rangoB = vista.abajo.rango;
        queda = dt;
        while (queda > 1e-4) {
          const paso = Math.min(PASO, queda);
          queda -= paso;
          integrarOla(yA, vA, s0A, s1A, rangoA, paso, vel);
          integrarOla(yB, vB, s0B, s1B, rangoB, paso, vel);
        }
        vista.alfa = alfa;
      } else if (congelada && llenadoT0 !== null && e.dt > 0) {
        llenadoT0 += e.dt * 1000;
      }
      if (!(congelada && !e.reposo)) vista.alfa = e.theta + phi;
      const factor = vista.llenado === null ? 1 : vista.llenado;
      const fa = Math.min(1, Math.max(0, volArriba * factor));
      const fb = Math.min(1, Math.max(0, volAbajo * factor));
      // En pausa o en el giro la línea no se mueve, así que no se vuelve a cortar.
      if (!congelada || e.reposo) {
        preparar(arriba, fa, vista.alfa, vista.arriba, cacheA);
        preparar(abajo, fb, vista.alfa, vista.abajo, cacheB);
      }
      vista.phi = phi;
      vista.volArriba = volArriba;
      vista.volAbajo = volAbajo;
      vista.cortarGotas = e.pausa || Math.abs(e.theta) > THETA_GOTAS || e.enGiro;
      const quieto =
        !e.corriendo &&
        vista.llenado === null &&
        Math.abs(phi) < PHI_QUIETO &&
        Math.abs(phiV) < PHI_VEL_QUIETA &&
        olasQuietas(yA, vA) &&
        olasQuietas(yB, vB);
      vista.sigue = !congelada && !quieto;
      return vista;
    },
  };
}
