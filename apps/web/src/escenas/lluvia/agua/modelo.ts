import type { SessionSnapshot } from '@reloj/core';

import type { EntradaPaso, GeometriaFrasco } from '../../../comun/frasco';
import { nivelDeDuracion } from './nivel';

/** 1,8 Hz. El vaivén cruza la horizontal y se apaga en menos de un segundo. */
const OMEGA = 11.3;
const ZETA = 0.3;
const KAPPA = 0.35;
const OLAS = 32;
const C_ANCHO = 0.9;
const BETA = 2.4;
const EPSILON = 0.08;
const TOPE_OLA = 0.04;
const PASO = 1 / 60;
const CONSTANTE_VOLUMEN = 0.6;
/** Por debajo de esto el muelle ya está quieto y el bucle puede dormirse. */
const PHI_QUIETO = (0.2 * Math.PI) / 180;
const PHI_VEL_QUIETA = 0.02;
const OLA_QUIETA = 0.1;

export interface Superficie {
  dibujar: boolean;
  lleno: boolean;
  /** Proyección de la línea sobre la vertical del mundo, en px desde el centro. */
  h: number;
  /** Dominio de las 32 olas: el ancho del bulbo, en px. */
  s0: number;
  s1: number;
  /** Donde esa línea encuentra el cristal. */
  contacto0: number;
  contacto1: number;
  readonly onda: Float64Array;
}

export interface VistaAgua {
  angulo: number;
  /** Ángulo del frasco más el vaivén. La línea queda horizontal cuando vale lo mismo que el frasco. */
  alfa: number;
  ancho: number;
  alto: number;
  cuello: number;
  arriba: Superficie;
  abajo: Superficie;
}

export interface ModeloAgua {
  fijarGeo(geo: GeometriaFrasco): void;
  fallar(): void;
  paso(e: EntradaPaso, ancho: number, alto: number): boolean;
  alVoltear(motivo: 'reinicio' | 'fase', snap: SessionSnapshot): void;
  /** Una gota suma −0,6 px en el punto de la ola más cercano. Lo usa la vuelta de las gotas. */
  pulso(bulbo: 'arriba' | 'abajo', s: number): void;
  vista(): VistaAgua;
  destruir(): void;
}

interface NubePuntos {
  readonly n: number;
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly alturas: Float64Array;
}

function suave(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function superficie(onda: Float64Array): Superficie {
  return { dibujar: false, lleno: false, h: 0, s0: 0, s1: 0, contacto0: 0, contacto1: 0, onda };
}

/** El k-ésimo valor más alto. k empieza en 1. */
function kesimoMayor(a: Float64Array, n: number, k: number): number {
  let lo = 0;
  let hi = n - 1;
  const objetivo = Math.min(n - 1, Math.max(0, k - 1));
  while (lo < hi) {
    const pivote = a[lo + ((hi - lo) >> 1)] ?? 0;
    let i = lo;
    let j = hi;
    while (i <= j) {
      while ((a[i] ?? 0) > pivote) i += 1;
      while ((a[j] ?? 0) < pivote) j -= 1;
      if (i <= j) {
        const tmp = a[i] ?? 0;
        a[i] = a[j] ?? 0;
        a[j] = tmp;
        i += 1;
        j -= 1;
      }
    }
    if (objetivo <= j) hi = j;
    else if (objetivo >= i) lo = i;
    else break;
  }
  return a[objetivo] ?? 0;
}

function puntosDe(fracciones: Float32Array, ancho: number, alto: number): NubePuntos {
  const n = fracciones.length / 2;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = ((fracciones[i * 2] ?? 0.5) - 0.5) * ancho;
    py[i] = ((fracciones[i * 2 + 1] ?? 0.5) - 0.5) * alto;
  }
  return { n, px, py, alturas: new Float64Array(n) };
}

function objetivos(
  snap: SessionSnapshot,
  nArriba: number,
  nAbajo: number,
): { arriba: number; abajo: number } {
  const nivel = nivelDeDuracion(snap.durationMs);
  const resto = snap.durationMs > 0 ? Math.min(1, Math.max(0, snap.remainingMs / snap.durationMs)) : 0;
  const ptsArriba = nivel * resto * nArriba;
  const ptsAbajo = nivel * nArriba - ptsArriba;
  return {
    arriba: nArriba > 0 ? ptsArriba / nArriba : 0,
    abajo: nAbajo > 0 ? ptsAbajo / nAbajo : 0,
  };
}

/**
 * Masa de agua. La superficie sale del k-ésimo punto más bajo,
 * así que es horizontal en el mundo y el volumen no cambia al girar.
 * El muelle la mece; las 32 alturas son la ola, con media cero.
 */
export function crearModelo(): ModeloAgua {
  let muerto = false;
  let fallo = false;
  let geo: GeometriaFrasco | null = null;
  let arriba: NubePuntos | null = null;
  let abajo: NubePuntos | null = null;
  let medidaAncho = 0;
  let medidaAlto = 0;
  let volArriba = 0;
  let volAbajo = 0;
  let iniciado = false;
  let phi = 0;
  let phiV = 0;
  let velPrevia = 0;
  let saltar = false;
  let turns: number | null = null;
  const yA = new Float64Array(OLAS);
  const vA = new Float64Array(OLAS);
  const yB = new Float64Array(OLAS);
  const vB = new Float64Array(OLAS);
  const vista: VistaAgua = {
    angulo: 0,
    alfa: 0,
    ancho: 0,
    alto: 0,
    cuello: 0.5,
    arriba: superficie(yA),
    abajo: superficie(yB),
  };

  let volteo: { tipo: 'reinicio' | 'fase'; t0: number; a0: number; b0: number } | null = null;
  let sujetado = false;

  const asegurar = (ancho: number, alto: number) => {
    if (!geo || (arriba && ancho === medidaAncho && alto === medidaAlto)) return;
    medidaAncho = ancho;
    medidaAlto = alto;
    arriba = puntosDe(geo.puntos.arriba, ancho, alto);
    abajo = puntosDe(geo.puntos.abajo, ancho, alto);
    vista.cuello = geo.cuelloY;
    vista.ancho = ancho;
    vista.alto = alto;
  };

  const invertirOlas = () => {
    for (let i = 0; i < OLAS; i++) {
      yA[i] = -(yA[i] ?? 0);
      vA[i] = -(vA[i] ?? 0);
      yB[i] = -(yB[i] ?? 0);
      vB[i] = -(vB[i] ?? 0);
    }
  };

  const intercambiar = () => {
    const tmp = volArriba;
    volArriba = volAbajo;
    volAbajo = tmp;
    for (let i = 0; i < OLAS; i++) {
      const y = yA[i] ?? 0;
      const v = vA[i] ?? 0;
      yA[i] = yB[i] ?? 0;
      vA[i] = vB[i] ?? 0;
      yB[i] = y;
      vB[i] = v;
    }
    phi = -phi;
    phiV = -phiV;
    invertirOlas();
    saltar = true;
  };

  const integrarMuelle = (dt: number, alpha: number) => {
    const acc = -OMEGA * OMEGA * phi - 2 * ZETA * OMEGA * phiV - KAPPA * alpha;
    phiV += acc * dt;
    phi += phiV * dt;
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

  const proyectar = (nube: NubePuntos, alfa: number) => {
    const sen = Math.sin(alfa);
    const cos = Math.cos(alfa);
    const { n, px, py, alturas } = nube;
    let s0 = Infinity;
    let s1 = -Infinity;
    let h0 = Infinity;
    let h1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = px[i] ?? 0;
      const y = py[i] ?? 0;
      const h = x * sen + y * cos;
      alturas[i] = h;
      const s = x * cos - y * sen;
      if (s < s0) s0 = s;
      if (s > s1) s1 = s;
      if (h < h0) h0 = h;
      if (h > h1) h1 = h;
    }
    return { s0, s1, h0, h1 };
  };

  const cuerda = (nube: NubePuntos, alfa: number, h: number, banda: number) => {
    const sen = Math.sin(alfa);
    const cos = Math.cos(alfa);
    let s0 = Infinity;
    let s1 = -Infinity;
    let cuenta = 0;
    for (let i = 0; i < nube.n; i++) {
      const x = nube.px[i] ?? 0;
      const y = nube.py[i] ?? 0;
      const altura = x * sen + y * cos;
      if (Math.abs(altura - h) > banda) continue;
      const s = x * cos - y * sen;
      if (s < s0) s0 = s;
      if (s > s1) s1 = s;
      cuenta += 1;
    }
    return cuenta >= 4 ? { s0, s1 } : null;
  };

  const preparar = (
    nube: NubePuntos,
    fraccion: number,
    alfa: number,
    sup: Superficie,
    ext: { s0: number; s1: number },
  ) => {
    const n = nube.n;
    const pts = Math.round(Math.min(1, Math.max(0, fraccion)) * n);
    sup.s0 = ext.s0;
    sup.s1 = ext.s1;
    if (n < 4 || pts <= 0) {
      sup.dibujar = false;
      sup.lleno = false;
      return;
    }
    if (pts >= n) {
      sup.dibujar = true;
      sup.lleno = true;
      sup.h = 0;
      sup.contacto0 = ext.s0;
      sup.contacto1 = ext.s1;
      return;
    }
    const h = kesimoMayor(nube.alturas, n, pts);
    const banda = Math.max(8, (ext.s1 - ext.s0) * 0.04);
    const corte = cuerda(nube, alfa, h, banda) ?? cuerda(nube, alfa, h, banda * 3) ?? ext;
    sup.dibujar = true;
    sup.lleno = false;
    sup.h = h;
    sup.contacto0 = corte.s0;
    sup.contacto1 = corte.s1;
  };

  const olasQuietas = (y: Float64Array, v: Float64Array) => {
    for (let i = 0; i < OLAS; i++) {
      if (Math.abs(y[i] ?? 0) > OLA_QUIETA || Math.abs(v[i] ?? 0) > OLA_QUIETA) return false;
    }
    return true;
  };

  return {
    fijarGeo(g) {
      geo = g;
      arriba = null;
      vista.cuello = g.cuelloY;
    },
    fallar() {
      fallo = true;
    },
    destruir() {
      muerto = true;
      geo = null;
    },
    vista() {
      return vista;
    },
    pulso(bulbo, s) {
      const sup = bulbo === 'arriba' ? vista.arriba : vista.abajo;
      const y = bulbo === 'arriba' ? yA : yB;
      const ancho = sup.s1 - sup.s0;
      if (!(ancho > 1)) return;
      const t = Math.min(1, Math.max(0, (s - sup.s0) / ancho));
      const i = Math.round(t * (OLAS - 1));
      y[i] = (y[i] ?? 0) - 0.6;
    },
    alVoltear(motivo, snap) {
      if (muerto) return;
      if (motivo === 'fase') {
        intercambiar();
        volteo = null;
        return;
      }
      if (!sujetado) {
        sujetado = true;
        return;
      }
      intercambiar();
      const nivel = nivelDeDuracion(snap.durationMs);
      volArriba = nivel;
      volAbajo = 0;
      sujetado = false;
      volteo = null;
    },
    paso(e, ancho, alto) {
      if (muerto || fallo) return false;
      if (!geo || ancho < 2 || alto < 2) return !fallo;
      asegurar(ancho, alto);
      if (!arriba || !abajo) return true;
      vista.angulo = e.angulo;
      vista.alfa = e.angulo + phi;
      vista.ancho = ancho;
      vista.alto = alto;

      const snap = e.snap;
      if (turns === null) turns = snap.transitions;
      else if (snap.transitions !== turns) {
        turns = snap.transitions;
        if (e.reducir) intercambiar();
      }

      const obj = objetivos(snap, arriba.n, abajo.n);
      if (!iniciado) {
        volArriba = obj.arriba;
        volAbajo = obj.abajo;
        iniciado = true;
      }

      const dtFrame = Math.min(0.1, Math.max(0, e.dt));
      const alpha = saltar || dtFrame <= 0 ? 0 : (e.velocidad - velPrevia) / dtFrame;
      velPrevia = e.velocidad;
      saltar = false;

      if (e.fase === 'volteo') {
        if (!volteo) {
          volteo = {
            tipo: snap.status === 'running' ? 'fase' : 'reinicio',
            t0: e.ahora,
            a0: volArriba,
            b0: volAbajo,
          };
          sujetado = false;
        }
        if (volteo.tipo === 'reinicio') {
          const t = Math.min(1, Math.max(0, (e.ahora - volteo.t0) / 1000));
          const u = t >= 0.6 ? 1 : suave(t / 0.6);
          const destino =
            abajo.n > 0 ? Math.min(1, (nivelDeDuracion(snap.durationMs) * arriba.n) / abajo.n) : 0;
          volArriba = volteo.a0 * (1 - u);
          volAbajo = volteo.b0 + (destino - volteo.b0) * u;
        }
      } else if (volteo && e.fase === 'reposo') {
        volteo = null;
      }

      if (!(e.fase === 'volteo' && volteo?.tipo === 'reinicio')) {
        const k = 1 - Math.exp(-dtFrame / CONSTANTE_VOLUMEN);
        if (!(e.fase === 'volteo' && volteo?.tipo === 'fase')) {
          volArriba += (obj.arriba - volArriba) * k;
          volAbajo += (obj.abajo - volAbajo) * k;
        }
      }

      let queda = dtFrame;
      while (queda > 1e-4) {
        const dt = Math.min(PASO, queda);
        queda -= dt;
        integrarMuelle(dt, alpha);
      }
      vista.alfa = e.angulo + phi;
      const extA = proyectar(arriba, vista.alfa);
      const extB = proyectar(abajo, vista.alfa);
      queda = dtFrame;
      while (queda > 1e-4) {
        const dt = Math.min(PASO, queda);
        queda -= dt;
        integrarOla(yA, vA, extA.s0, extA.s1, Math.max(1, extA.h1 - extA.h0), dt, e.velocidad);
        integrarOla(yB, vB, extB.s0, extB.s1, Math.max(1, extB.h1 - extB.h0), dt, e.velocidad);
      }
      preparar(arriba, volArriba, vista.alfa, vista.arriba, extA);
      preparar(abajo, volAbajo, vista.alfa, vista.abajo, extB);

      const cerca = Math.abs(volArriba - obj.arriba) < 0.004 && Math.abs(volAbajo - obj.abajo) < 0.004;
      const quieto =
        e.fase === 'reposo' &&
        snap.status !== 'running' &&
        Math.abs(phi) < PHI_QUIETO &&
        Math.abs(phiV) < PHI_VEL_QUIETA &&
        olasQuietas(yA, vA) &&
        olasQuietas(yB, vB) &&
        cerca &&
        !volteo;
      return !quieto;
    },
  };
}
