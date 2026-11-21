import { CUELLO_FILA, CUELLO_X, FOTO_ALTO, FOTO_ANCHO, type Pintura } from '../../../comun/frasco';
import { crearAguaVidrio, matrizFrasco, type AguaVidrio, type EstadoBulbo, type Matriz2D } from './vidrio';
import type { VistaAgua } from './modelo';

const PASOS = 40;
/** Lado derecho de arriba a abajo y lado izquierdo de vuelta. */
const POLI = PASOS * 4;
const OLAS = 32;

/** La capa de encima. Durante el fundido hay dos, y la vieja es la primera. */
function capaDeFondo(): Element | null {
  const capas = document.querySelectorAll('.fondo-capa.se-ve');
  return capas.length > 0 ? (capas[capas.length - 1] ?? null) : null;
}

function fondoVisible(): HTMLImageElement | HTMLVideoElement | null {
  const capa = capaDeFondo();
  if (!capa) return null;
  const video = capa.querySelector('video.fondo-video');
  if (video instanceof HTMLVideoElement && video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
    return video;
  }
  const img = capa.querySelector('img.fondo-medio');
  if (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0) return img;
  return null;
}

/**
 * El bucle del frasco se duerme en reposo. Si el primer fotograma copió
 * el fondo de la escena anterior, esa copia se queda hasta el próximo clic.
 * Hay que seguir pintando mientras el fundido no ha dejado un solo fondo
 * listo, y mientras ese fondo es un vídeo que sigue avanzando.
 */
export function fondoPendiente(nacido: number): boolean {
  if (performance.now() - nacido < 720) return true;
  const capas = document.querySelectorAll('.fondo-capa.se-ve');
  if (capas.length !== 1) return capas.length > 1;
  const capa = capas[0];
  if (!capa) return false;
  const video = capa.querySelector('video.fondo-video');
  if (video instanceof HTMLVideoElement) {
    if (video.readyState < 2 || video.videoWidth === 0) return true;
    if (!video.paused && !video.ended) return true;
  }
  const img = capa.querySelector('img.fondo-medio');
  if (!(img instanceof HTMLImageElement)) return false;
  if (!img.complete || img.naturalWidth < 2) return true;
  return img.getBoundingClientRect().width < 2;
}

/** Área del polígono por debajo de y = nivel. y crece hacia abajo. */
function areaBajo(p: Float32Array, nivel: number): number {
  let primeroX = 0;
  let primeroY = 0;
  let ultimoX = 0;
  let ultimoY = 0;
  let hay = false;
  let suma = 0;
  const emitir = (x: number, y: number) => {
    if (!hay) {
      primeroX = x;
      primeroY = y;
      hay = true;
    } else suma += ultimoX * y - x * ultimoY;
    ultimoX = x;
    ultimoY = y;
  };
  const n = p.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    const px = p[i] ?? 0;
    const py = p[i + 1] ?? 0;
    const qx = p[j] ?? 0;
    const qy = p[j + 1] ?? 0;
    const pDentro = py >= nivel;
    const qDentro = qy >= nivel;
    if (pDentro !== qDentro && qy !== py) emitir(px + ((nivel - py) / (qy - py)) * (qx - px), nivel);
    if (qDentro) emitir(qx, qy);
  }
  if (hay) suma += ultimoX * primeroY - primeroX * ultimoY;
  return Math.abs(suma) / 2;
}

function nivelPorArea(p: Float32Array, yMin: number, yMax: number, area: number): number {
  if (area <= 0) return yMax + 2;
  let arriba = yMin;
  let abajo = yMax;
  for (let i = 0; i < 24; i++) {
    const medio = (arriba + abajo) / 2;
    if (areaBajo(p, medio) > area) arriba = medio;
    else abajo = medio;
  }
  return (arriba + abajo) / 2;
}

function aMundo(origen: Float32Array, m: Matriz2D, destino: Float32Array): void {
  for (let i = 0; i < origen.length; i += 2) {
    const x = origen[i] ?? 0;
    const y = origen[i + 1] ?? 0;
    destino[i] = m.a * x + m.c * y + m.e;
    destino[i + 1] = m.b * x + m.d * y + m.f;
  }
}

function nivelDe(mundo: Float32Array, fraccion: number): number {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 1; i < mundo.length; i += 2) {
    const y = mundo[i] ?? 0;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (!(y1 > y0)) return y1;
  if (fraccion <= 0.004) return y1 + 2;
  if (fraccion >= 0.996) return y0 - 2;
  return nivelPorArea(mundo, y0, y1, fraccion * areaBajo(mundo, y0 - 2));
}

function anchoDe(p: Float32Array): number {
  let x0 = Infinity;
  let x1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i] ?? 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
  }
  return x1 > x0 ? x1 - x0 : 1;
}

/**
 * Silueta del bulbo en px del frasco, centrada en el cuello.
 * Sale de los puntos interiores: pared con pared, sin un corte vertical.
 */
function escribirSilueta(fracciones: Float32Array, w: number, h: number, out: Float32Array): boolean {
  const n = fracciones.length / 2;
  if (n < 8) return false;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = fracciones[i * 2 + 1] ?? 0.5;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const span = Math.max(1e-6, yMax - yMin);
  const minX = new Float64Array(PASOS).fill(Infinity);
  const maxX = new Float64Array(PASOS).fill(-Infinity);
  for (let i = 0; i < n; i++) {
    const x = fracciones[i * 2] ?? 0.5;
    const y = fracciones[i * 2 + 1] ?? 0.5;
    let b = Math.round(((y - yMin) / span) * (PASOS - 1));
    if (b < 0) b = 0;
    if (b > PASOS - 1) b = PASOS - 1;
    if (x < (minX[b] ?? Infinity)) minX[b] = x;
    if (x > (maxX[b] ?? -Infinity)) maxX[b] = x;
  }
  let visto = false;
  let guardaMin = 0.5;
  let guardaMax = 0.5;
  for (let i = 0; i < PASOS; i++) {
    if ((minX[i] ?? Infinity) !== Infinity) {
      guardaMin = minX[i] ?? guardaMin;
      guardaMax = maxX[i] ?? guardaMax;
      visto = true;
    } else if (visto) {
      minX[i] = guardaMin;
      maxX[i] = guardaMax;
    }
  }
  visto = false;
  for (let i = PASOS - 1; i >= 0; i--) {
    if ((minX[i] ?? Infinity) !== Infinity) {
      guardaMin = minX[i] ?? guardaMin;
      guardaMax = maxX[i] ?? guardaMax;
      visto = true;
    } else if (visto) {
      minX[i] = guardaMin;
      maxX[i] = guardaMax;
    }
  }
  for (let i = 0; i < PASOS; i++) {
    const y = (yMin + (span * i) / (PASOS - 1) - 0.5) * h;
    out[i * 2] = ((maxX[i] ?? 0.5) - 0.5) * w;
    out[i * 2 + 1] = y;
  }
  for (let i = 0; i < PASOS; i++) {
    const j = PASOS - 1 - i;
    const y = (yMin + (span * j) / (PASOS - 1) - 0.5) * h;
    const k = PASOS + i;
    out[k * 2] = ((minX[j] ?? 0.5) - 0.5) * w;
    out[k * 2 + 1] = y;
  }
  return true;
}

function poseDelContexto(ctx: CanvasRenderingContext2D): number {
  const dpr = window.devicePixelRatio || 1;
  const t = ctx.getTransform();
  const det = t.a * t.d - t.b * t.c;
  if (!(det > 0)) return 1;
  const pose = Math.sqrt(det) / dpr;
  return pose > 0.05 && pose < 4 ? pose : 1;
}

/**
 * El vidrio nos llama ya girados. El agua se pinta en px de pantalla.
 * Con el frasco 3D la matriz de pantalla llega hecha (px de la ventana → hoja).
 */
function ponerEnPantalla(ctx: CanvasRenderingContext2D, matriz?: DOMMatrixReadOnly): void {
  if (matriz) {
    ctx.setTransform(matriz);
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const lienzo = ctx.canvas.getBoundingClientRect();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(-lienzo.left, -lienzo.top);
}

function escribirAlturas(destino: Float32Array, phi: number, ancho: number, onda: ArrayLike<number>): void {
  const n = destino.length;
  const pendiente = Math.tan(Math.max(-1.1, Math.min(1.1, phi)));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    destino[i] = (u - 0.5) * ancho * pendiente + (onda[Math.min(i, onda.length - 1)] ?? 0);
  }
}

export interface PincelAgua {
  pintar(ctx: CanvasRenderingContext2D, p: Pintura, vista: VistaAgua, caudal: number, dtMs: number): void;
  destruir(): void;
}

/**
 * El agua de Picasso: vidrio un poco opaco, sin tinte azul, y el fondo de verdad
 * doblado dentro. La horizontal es la de la pantalla, no la del frasco.
 */
export function crearPincel(pulso: (bulbo: 'arriba' | 'abajo', s: number) => void): PincelAgua {
  const poliA = new Float32Array(POLI);
  const poliB = new Float32Array(POLI);
  const mundoA = new Float32Array(POLI);
  const mundoB = new Float32Array(POLI);
  const alturasA = new Float32Array(OLAS);
  const alturasB = new Float32Array(OLAS);
  const cuello = { x: 0, y: 0 };
  const matriz: Matriz2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  let agua: AguaVidrio | null = null;
  let firma = '';
  let anchoVentana = 0;
  let altoVentana = 0;
  let vistaActual: VistaAgua | null = null;

  const asegurar = (p: Pintura): AguaVidrio | null => {
    const clave = `${p.caja.w.toFixed(1)}x${p.caja.h.toFixed(1)}`;
    if (clave !== firma || !agua) {
      const listaA = escribirSilueta(p.geo.puntos.arriba, p.caja.w, p.caja.h, poliA);
      const listaB = escribirSilueta(p.geo.puntos.abajo, p.caja.w, p.caja.h, poliB);
      if (!listaA || !listaB) return null;
      cuello.x = 0;
      cuello.y = (p.geo.cuelloY - 0.5) * p.caja.h;
      firma = clave;
      if (!agua) {
        agua = crearAguaVidrio({
          bulbos: [poliA, poliB],
          cuello,
          // Frasco 3D: refracta el vidrio de verdad. El agua solo pone su fondo borroso, recto
          // (sin lupa ni desvío): no se suman dos refracciones. Velo y color, iguales.
          refraccion: !p.pantalla,
          alCaerGota(bulbo, u) {
            const vista = vistaActual;
            if (!vista) return;
            const sup = bulbo === 0 ? vista.arriba : vista.abajo;
            const s = sup.s0 + Math.min(1, Math.max(0, u)) * (sup.s1 - sup.s0);
            pulso(bulbo === 0 ? 'arriba' : 'abajo', s);
          },
        });
        anchoVentana = 0;
      }
    }
    return agua;
  };

  return {
    pintar(ctx, p, vista, caudal, dtMs) {
      vistaActual = vista;
      const vidrio = asegurar(p);
      if (!vidrio) return;
      const pose = p.pantalla ? (p.pantalla.escala ?? 1) : poseDelContexto(ctx);
      const vidrioEl = document.querySelector('.glass-canvas');
      const origen = vidrioEl?.getBoundingClientRect();
      const nx = (CUELLO_X / FOTO_ANCHO - 0.5) * p.caja.w;
      const ny = (CUELLO_FILA / FOTO_ALTO - 0.5) * p.caja.h;
      // El mundo del agua sigue siendo la ventana: su copia del fondo se coloca con el
      // rectángulo de la foto del DOM, que tiene el mismo encuadre que el fondo WebGL.
      const cuelloX = p.pantalla?.cuello.x ?? (origen?.left ?? 0) + p.caja.x + p.caja.w * (CUELLO_X / FOTO_ANCHO);
      const cuelloY = p.pantalla?.cuello.y ?? (origen?.top ?? 0) + p.caja.y + p.caja.h * (CUELLO_FILA / FOTO_ALTO);

      ctx.save();
      ponerEnPantalla(ctx, p.pantalla?.matriz);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const ancho = Math.max(1, window.innerWidth);
      const alto = Math.max(1, window.innerHeight);
      if (ancho !== anchoVentana || alto !== altoVentana) {
        anchoVentana = ancho;
        altoVentana = alto;
        vidrio.redimensionar(ancho, alto);
      }
      const fondo = fondoVisible();
      if (fondo) vidrio.actualizarFondo(fondo);

      // Los polígonos están medidos desde el centro de la caja. El pivote
      // es el cuello, el mismo que el del vidrio, para que no orbiten.
      matrizFrasco(p.angulo, 0, 0, pose, matriz);
      matriz.e = cuelloX - matriz.a * nx + matriz.b * ny;
      matriz.f = cuelloY - matriz.b * nx - matriz.a * ny;
      const fundido = vista.fundido;
      const u = fundido?.u ?? 0;
      const fracA = fundido ? vista.volArriba * (1 - u) + fundido.arriba * u : vista.volArriba;
      const fracB = fundido ? vista.volAbajo * (1 - u) + fundido.abajo * u : vista.volAbajo;
      const phi = (vista.alfa - vista.angulo) * (fundido ? 1 - u : 1);

      aMundo(poliA, matriz, mundoA);
      aMundo(poliB, matriz, mundoB);
      escribirAlturas(alturasA, phi, anchoDe(mundoA), vista.arriba.onda);
      escribirAlturas(alturasB, phi, anchoDe(mundoB), vista.abajo.onda);
      const bulboA: EstadoBulbo = { nivel: nivelDe(mundoA, fracA), alturas: alturasA };
      const bulboB: EstadoBulbo = { nivel: nivelDe(mundoB, fracB), alturas: alturasB };
      vidrio.pintarAgua(ctx, {
        matriz,
        bulbos: [bulboA, bulboB],
        opacidad: fundido ? 1 - 0.65 * Math.sin(Math.PI * u) : 1,
        desenfoque: fundido ? 8 * Math.sin(Math.PI * u) : 0,
      });
      vidrio.pintarGotas(ctx, { caudal, dt: dtMs });
      ctx.restore();
    },
    destruir() {
      agua?.destruir();
      agua = null;
      firma = '';
    },
  };
}
