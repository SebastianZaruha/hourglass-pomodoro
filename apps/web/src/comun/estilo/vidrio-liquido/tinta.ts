// Tinta del texto según lo que hay DETRÁS de la hoja, sin velo.
//
// El vidrio no tiene color propio, así que la legibilidad depende de la escena:
// Clásico claro (crema) pide texto oscuro; Lluvia claro con rocas detrás del menú
// pide texto blanco. Aquí se mira la escena bajo la hoja y se elige la tinta que da
// más contraste en el PEOR punto, y solo si hace falta se ajusta un poco el brillo
// del desenfoque, dentro de un margen pequeño (no se percibe como color).
//
// Cómo se mira: se pintan en un lienzo diminuto las capas de la escena que hay bajo
// la hoja (<img>, <video> y <canvas> de la escena, en su caja real) y se promedia en
// celdas del tamaño del desenfoque. Cuesta < 1 ms y se repite cada ~1 s mientras la
// hoja está abierta (la escena cambia: vídeo, arena, modo claro/oscuro).

export type Tinta = 'clara' | 'oscura';

export interface ResultadoTinta {
  tinta: Tinta;
  luz: number; // brillo del desenfoque a usar (1 = el de la escena)
  contraste: number; // contraste estimado en el peor punto
}

export interface OpcionesTinta {
  /** Selector de las capas de la escena. */
  capas: string;
  /** Brillo base del modo (el --vl-luz del CSS). */
  luzBase: number;
  /** Margen de brillo permitido alrededor de luzBase (p. ej. 0.38 → ±38 %). */
  margen: number;
  /** Luminancia relativa de la tinta oscura (≈ 0.02 para #2a2623). */
  lumOscura: number;
  /** Margen hacia arriba (más brillo), menor que el de abajo. */
  margenArriba: number;
  /** Fracción del objetivo con la que el blanco ya gana (preferencia por el blanco). */
  preferenciaBlanco: number;
  /** Contraste objetivo (WCAG AA = 4.5). */
  objetivo: number;
  /** Tamaño de celda en px CSS (≈ el desenfoque). */
  celda: number;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

let lienzo: HTMLCanvasElement | null = null;

/** Luminancias de la escena bajo `caja`, por celdas. null si no se puede leer. */
export function muestrear(caja: DOMRect, o: OpcionesTinta): Float32Array | null {
  const cw = Math.max(2, Math.min(48, Math.round(caja.width / o.celda)));
  const ch = Math.max(2, Math.min(48, Math.round(caja.height / o.celda)));
  lienzo ??= document.createElement('canvas');
  if (lienzo.width !== cw || lienzo.height !== ch) {
    lienzo.width = cw;
    lienzo.height = ch;
  }
  const g = lienzo.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cw, ch);
  // Debajo de las capas, el color de fondo de la página: donde la foto no llega
  // (p. ej. el pie de la hoja en móvil) se ve ese color, no un gris inventado.
  const base = colorDeFondo(document.querySelector(o.capas));
  if (base) {
    g.fillStyle = base;
    g.fillRect(0, 0, cw, ch);
  }
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'low';
  const sx = cw / caja.width;
  const sy = ch / caja.height;
  let pintado = false;
  for (const capa of document.querySelectorAll<HTMLElement>(o.capas)) {
    const cs = getComputedStyle(capa);
    const op = parseFloat(cs.opacity);
    if (cs.visibility === 'hidden' || cs.display === 'none' || !(op > 0.02)) continue;
    const r = capa.getBoundingClientRect();
    if (r.right < caja.left || r.left > caja.right || r.bottom < caja.top || r.top > caja.bottom) continue;
    if (capa instanceof HTMLImageElement && !(capa.complete && capa.naturalWidth)) continue;
    if (capa instanceof HTMLVideoElement && capa.readyState < 2) continue;
    try {
      g.globalAlpha = op;
      const d = destino(capa, cs, r);
      g.drawImage(capa as CanvasImageSource, (d.x - caja.left) * sx, (d.y - caja.top) * sy, d.w * sx, d.h * sy);
      pintado = true;
    } catch {
      // Capa de otro origen o aún sin decodificar: se ignora.
    }
  }
  if (!pintado) return null;
  let datos: Uint8ClampedArray;
  try {
    datos = g.getImageData(0, 0, cw, ch).data;
  } catch {
    return null; // lienzo contaminado (otro origen)
  }
  let L: Float32Array = new Float32Array(cw * ch);
  for (let i = 0; i < L.length; i++) {
    const a = datos[i * 4 + 3]! / 255;
    // Lo transparente cuenta como gris medio: no sabemos qué hay y así no decide por sí solo.
    const r = (datos[i * 4]! / 255) * a + 0.5 * (1 - a);
    const v = (datos[i * 4 + 1]! / 255) * a + 0.5 * (1 - a);
    const b = (datos[i * 4 + 2]! / 255) * a + 0.5 * (1 - a);
    L[i] = 0.2126 * lin(r) + 0.7152 * lin(v) + 0.0722 * lin(b);
  }
  // Dos pasadas de caja 3×3 ≈ gaussiana de 1 celda: el blur real del vidrio mezcla
  // bastante más que una celda, así que sin esto se exagera el contraste de la escena.
  for (let pasada = 0; pasada < 2; pasada++) L = suavizar(L, cw, ch);
  return L;
}

/**
 * Dónde pinta de verdad una foto o un vídeo dentro de su caja: con object-fit cover
 * (el fondo en móvil vertical) la imagen se sale por los lados y se recorta; pintarla
 * entera en la caja la aplastaría y se miraría otra parte de la escena.
 */
function destino(capa: HTMLElement, cs: CSSStyleDeclaration, r: DOMRect) {
  const nw = capa instanceof HTMLImageElement ? capa.naturalWidth : capa instanceof HTMLVideoElement ? capa.videoWidth : 0;
  const nh = capa instanceof HTMLImageElement ? capa.naturalHeight : capa instanceof HTMLVideoElement ? capa.videoHeight : 0;
  const ajuste = cs.objectFit;
  if (!nw || !nh || (ajuste !== 'cover' && ajuste !== 'contain')) return { x: r.left, y: r.top, w: r.width, h: r.height };
  const k = ajuste === 'cover' ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
  const w = nw * k;
  const h = nh * k;
  // object-position: solo porcentajes y palabras clave (lo que usa la app); por defecto, centrado.
  const pos = cs.objectPosition.split(' ');
  const frac = (v: string | undefined, porDefecto: number) => {
    if (!v) return porDefecto;
    if (v.endsWith('%')) return parseFloat(v) / 100;
    return ({ left: 0, top: 0, center: 0.5, right: 1, bottom: 1 } as Record<string, number>)[v] ?? porDefecto;
  };
  const px = (v: string | undefined, libre: number, porDefecto: number) => (v?.endsWith('px') ? parseFloat(v) : libre * frac(v, porDefecto));
  return { x: r.left + px(pos[0], r.width - w, 0.5), y: r.top + px(pos[1], r.height - h, 0.5), w, h };
}

function colorDeFondo(desde: Element | null): string | null {
  for (let e: Element | null = desde; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c)) return c;
  }
  return null;
}

function suavizar(L: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(L.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let suma = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          suma += L[yy * w + Math.min(w - 1, Math.max(0, x + dx))]!;
          n++;
        }
      }
      out[y * w + x] = suma / n;
    }
  }
  return out;
}

function percentil(L: Float32Array, p: number) {
  const s = Array.from(L).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))] ?? 0;
}

/**
 * Elige tinta y brillo para el peor punto.
 * Se prefiere el texto blanco (es el del diseño y el vidrio oscurecido se lee como vidrio);
 * la tinta oscura entra solo cuando el blanco no llega ni bajando el brillo al mínimo
 * (fondos crema como Clásico claro). Hacia arriba el brillo se mueve menos que hacia abajo:
 * aclarar mucho un fondo cálido lo convierte en un caramelo naranja, que sí se ve como color.
 */
export function elegirTinta(L: Float32Array, o: OpcionesTinta, previa?: Tinta): ResultadoTinta {
  // brightness() del CSS multiplica los valores sRGB: en luminancia es ≈ luz^2.2.
  const escala = (luz: number) => luz ** 2.2;
  const claro = percentil(L, 1); // el punto más claro (ya suavizado): el peor para texto blanco
  const oscuro = percentil(L, 0); // el más oscuro (ya suavizado): el peor para texto oscuro
  const cBlanco = (luz: number) => 1.05 / (claro * escala(luz) + 0.05);
  const cOscuro = (luz: number) => (Math.min(1, oscuro * escala(luz)) + 0.05) / (o.lumOscura + 0.05);
  const min = o.luzBase * (1 - o.margen);
  const max = o.luzBase * (1 + o.margenArriba);
  // Brillo justo para llegar al objetivo con cada tinta (acotado al margen).
  const luzBlanco = Math.min(o.luzBase, Math.max(min, ((1.05 / o.objetivo - 0.05) / Math.max(claro, 1e-4)) ** (1 / 2.2)));
  const luzOscuro = Math.max(o.luzBase, Math.min(max, (((o.objetivo * (o.lumOscura + 0.05) - 0.05) / Math.max(oscuro, 1e-4)) ** (1 / 2.2))));
  const blanco = { tinta: 'clara' as const, luz: luzBlanco, contraste: cBlanco(luzBlanco) };
  const negro = { tinta: 'oscura' as const, luz: luzOscuro, contraste: cOscuro(luzOscuro) };
  // Histéresis: volver al blanco desde la tinta oscura pide el objetivo entero; quedarse
  // en blanco basta con el umbral de preferencia. Así no parpadea con la escena viva.
  const umbralBlanco = o.objetivo * (previa === 'oscura' ? 1 : o.preferenciaBlanco);
  if (blanco.contraste >= umbralBlanco) return blanco;
  if (negro.contraste >= o.objetivo) return negro;
  const mejor = blanco.contraste >= negro.contraste ? blanco : negro;
  const actual = previa === 'clara' ? blanco : previa === 'oscura' ? negro : null;
  return actual && actual.contraste * 1.08 >= mejor.contraste ? actual : mejor;
}

/**
 * Capas de la escena que se miran para elegir la tinta. Sin el lienzo WebGL del frasco 3D:
 * su búfer no se conserva entre fotogramas y, leído con drawImage, sale negro o vacío. El
 * fondo que pinta es el mismo <img>/<video> de .fondo-pila, que sigue debajo y sí se mira.
 */
export const CAPAS_ESCENA = '.scene img, .scene video, .scene canvas:not(.frasco-3d)';
const LUZ_MARGEN = 0.42; // hacia abajo, hasta −42 % del brillo del modo (vidrio ahumado, sin gris: ver README)
const LUZ_MARGEN_ARRIBA = 0.15; // hacia arriba, solo +15 %: más es un caramelo naranja en Arena
const PREFERENCIA_BLANCO = 0.9; // el blanco gana si llega al 90 % del objetivo del modelo
// WCAG AA es 4,5. El modelo (escena sin el canto, el grano ni la saturación) se queda
// algo corto frente a lo medido en capturas, así que apunta a 5,2 para llegar a 4,5 real.
const OBJETIVO = 5.5; // el modelo no ve el relleno de los botones ni el grano: margen sobre 4,5

/** Caja de layout (sin transform): offsetLeft/Top encadenados hasta el viewport. */
function cajaLayout(el: HTMLElement): DOMRect {
  let x = 0;
  let y = 0;
  let e: HTMLElement | null = el;
  while (e) {
    x += e.offsetLeft - (e === el ? 0 : e.scrollLeft);
    y += e.offsetTop - (e === el ? 0 : e.scrollTop);
    e = e.offsetParent as HTMLElement | null;
  }
  return new DOMRect(x - scrollX, y - scrollY, el.offsetWidth, el.offsetHeight);
}

// Parte fija del transform de cada hoja (p. ej. el cookies va centrado con translateX(-50%)).
// Se aprende con la hoja quieta y entera en pantalla; mientras entra o sale no se puede
// distinguir de la animación.
const desfase = new WeakMap<HTMLElement, { x: number; y: number }>();

/**
 * Dónde va a estar la hoja cuando se asiente: su caja de layout más la parte fija del
 * transform. Así la tinta se elige para la posición final antes de abrir y durante la
 * entrada (la hoja sube desde abajo con translateY), y no cambia a media animación.
 */
function cajaFinal(el: HTMLElement): DOMRect {
  const l = cajaLayout(el);
  const r = el.getBoundingClientRect();
  const quieta = !('vlMov' in el.dataset) && el.getAnimations().length === 0;
  const entera = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  if (quieta && entera) desfase.set(el, { x: r.left - l.left, y: r.top - l.top });
  const d = desfase.get(el) ?? { x: 0, y: 0 };
  return new DOMRect(l.left + d.x, l.top + d.y, l.width, l.height);
}

function cajaMuestra(el: HTMLElement, muestra?: string): DOMRect {
  if (!muestra) return cajaFinal(el);
  const hijos = [...el.querySelectorAll<HTMLElement>(muestra)].map((h) => h.getBoundingClientRect()).filter((r) => r.width > 0);
  if (!hijos.length) return cajaFinal(el);
  const x0 = Math.min(...hijos.map((r) => r.left));
  const y0 = Math.min(...hijos.map((r) => r.top));
  const x1 = Math.max(...hijos.map((r) => r.right));
  const y1 = Math.max(...hijos.map((r) => r.bottom));
  return new DOMRect(x0 - 16, y0 - 16, x1 - x0 + 32, y1 - y0 + 32);
}

function luminanciaDe(color: string): number | null {
  const m = color.trim().match(/^#([0-9a-f]{6})$/i);
  const n = m ? [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16)) : color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!n || n.length < 3 || n.some((v) => !Number.isFinite(v))) return null;
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(n[0]!) + 0.7152 * lin(n[1]!) + 0.0722 * lin(n[2]!);
}

/**
 * Pone data-vl-tinta="clara|oscura" y, si hace falta, --vl-luz en el elemento.
 * Se repite cada ~900 ms mientras la hoja está en pantalla y al abrirla (cambio de clase).
 */
export function vigilarTinta(el: HTMLElement, muestra?: string): () => void {
  let pendiente = 0;
  const medir = () => {
    pendiente = 0;
    if (el.offsetWidth < 2 || document.hidden) return;
    const caja = cajaMuestra(el, muestra);
    if (caja.bottom < 0 || caja.top > innerHeight || caja.right < 0 || caja.left > innerWidth) return;
    const cs = getComputedStyle(el);
    el.style.removeProperty('--vl-luz'); // el brillo base es el del modo (CSS), no el último ajuste
    const luzBase = parseFloat(getComputedStyle(el).getPropertyValue('--vl-luz')) || 1;
    const o: OpcionesTinta = {
      capas: CAPAS_ESCENA,
      luzBase,
      margen: LUZ_MARGEN,
      margenArriba: LUZ_MARGEN_ARRIBA,
      preferenciaBlanco: PREFERENCIA_BLANCO,
      lumOscura: luminanciaDe(cs.getPropertyValue('--vl-tinta-oscura')) ?? 0.02,
      objetivo: OBJETIVO,
      celda: Math.max(8, parseFloat(cs.getPropertyValue('--vl-blur')) || 24),
    };
    const L = muestrear(caja, o);
    if (!L) return;
    const r = elegirTinta(L, o, el.dataset.vlTinta as Tinta | undefined);
    if (el.dataset.vlTinta !== r.tinta) el.dataset.vlTinta = r.tinta;
    if (Math.abs(r.luz - luzBase) > 0.005) el.style.setProperty('--vl-luz', r.luz.toFixed(3));
  };
  const pronto = () => {
    if (!pendiente) pendiente = requestAnimationFrame(medir);
  };
  pronto();
  const reloj = window.setInterval(pronto, 900);
  el.addEventListener('transitionend', pronto);
  el.addEventListener('animationend', pronto);
  const cambios = new MutationObserver(pronto);
  cambios.observe(el, { attributes: true, attributeFilter: ['class'] });
  const app = el.closest('[data-scheme]');
  if (app) cambios.observe(app, { attributes: true, attributeFilter: ['data-scheme'] });
  return () => {
    clearInterval(reloj);
    el.removeEventListener('transitionend', pronto);
    el.removeEventListener('animationend', pronto);
    cancelAnimationFrame(pendiente);
    cambios.disconnect();
    el.style.removeProperty('--vl-luz');
    delete el.dataset.vlTinta;
  };
}
