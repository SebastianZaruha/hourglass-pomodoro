// El filtro SVG del vidrio (solo Chromium: es el único que acepta url() en backdrop-filter).
// El CSS aplica antes blur(), así que todo esto trabaja sobre el fondo YA desenfocado:
//
//   fondo desenfocado
//     → refracción del borde (mapa)            el canto dobla la luz de dentro hacia fuera
//     → escarcha (ruido de desplazamiento)     la superficie tiembla como vidrio esmerilado
//     → grano (ruido de brillo, media cero)    textura fina; no cambia el tono medio
//     + bisel = copia más clara y saturada del mismo fondo, recortada por la máscara del canto
//
// Todo lo que se mezcla con el fondo tiene que ir AQUÍ: dentro de un elemento con
// backdrop-filter, los hijos y ::before/::after con mix-blend-mode NO ven el fondo filtrado
// (mezclan con transparente) y acaban siendo un velo gris. Comprobado en Chromium y WebKit.
import { construirBrillo, construirEscarcha, construirMapa } from './mapa';

export interface OpcionesFiltro {
  profundidad: number;
  borde: number;
  suavizado: number;
  curvatura: number;
  escarcha: number;
  grano: number; // 0–1: amplitud del grano de brillo
  bisel: number; // 0–1: intensidad del brillo del canto
  resolucion: number;
}

const NS = 'http://www.w3.org/2000/svg';

function nodo(tipo: string, atributos: Record<string, string | number>) {
  const el = document.createElementNS(NS, tipo);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, String(v));
  return el;
}

export function crearFiltro(o: OpcionesFiltro) {
  const svg = nodo('svg', { 'aria-hidden': 'true', width: 0, height: 0 }) as SVGSVGElement;
  // No usamos display:none: algunos navegadores ignoran filtros de un SVG no renderizado.
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  const filtro = nodo('filter', { x: 0, y: 0, width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' });
  const img = { x: 0, y: 0, preserveAspectRatio: 'none' };
  const mapa = nodo('feImage', { ...img, result: 'mapa' });
  const ruido = nodo('feImage', { ...img, result: 'ruido' });
  const canto = nodo('feImage', { ...img, result: 'canto' });
  filtro.append(
    mapa,
    nodo('feDisplacementMap', { in: 'SourceGraphic', in2: 'mapa', scale: o.profundidad, xChannelSelector: 'R', yChannelSelector: 'G', result: 'doblado' }),
  );
  let ultimo = 'doblado';
  if (o.escarcha > 0 || o.grano > 0) filtro.append(ruido);
  if (o.escarcha > 0) {
    filtro.append(nodo('feDisplacementMap', { in: ultimo, in2: 'ruido', scale: o.escarcha, xChannelSelector: 'R', yChannelSelector: 'G', result: 'esmerilado' }));
    ultimo = 'esmerilado';
  }
  if (o.grano > 0) {
    // Canal B del ruido → gris; luego fondo + grano·(ruido − 0,5). Media cero: no aclara ni oscurece.
    filtro.append(
      nodo('feColorMatrix', { in: 'ruido', values: '0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 0 1', result: 'gris' }),
      nodo('feComposite', { in: ultimo, in2: 'gris', operator: 'arithmetic', k1: 0, k2: 1, k3: o.grano, k4: -o.grano / 2, result: 'granulado' }),
    );
    ultimo = 'granulado';
  }
  if (o.bisel > 0) {
    // El canto: el mismo fondo, más claro y más saturado, solo donde dice la máscara.
    const b = 1 + 0.9 * o.bisel;
    const s = 1.6;
    const r = 0.2126 * (1 - s), g = 0.7152 * (1 - s), bl = 0.0722 * (1 - s);
    const m = [
      [r + s, g, bl], [r, g + s, bl], [r, g, bl + s],
    ].map((f) => f.map((v) => (v * b).toFixed(4)).join(' ') + ' 0 0').join('  ');
    filtro.append(
      canto,
      nodo('feColorMatrix', { in: ultimo, values: `${m}  0 0 0 1 0`, result: 'luz' }),
      nodo('feComposite', { in: 'luz', in2: 'canto', operator: 'in', result: 'brillo' }),
    );
    const merge = nodo('feMerge', {});
    merge.append(nodo('feMergeNode', { in: ultimo }), nodo('feMergeNode', { in: 'brillo' }));
    filtro.append(merge);
  }
  svg.append(filtro);

  let tam = '';
  return {
    svg,
    filtro,
    /** Rehace los mapas para el tamaño del elemento. Devuelve true si ha cambiado algo. */
    medir(ancho: number, alto: number, radio: number): boolean {
      const clave = `${ancho}x${alto}x${radio}`;
      if (clave === tam) return false;
      tam = clave;
      const { borde, suavizado, curvatura, resolucion } = o;
      const poner = (el: Element, href: string) => {
        el.setAttribute('href', href);
        el.setAttribute('width', String(ancho));
        el.setAttribute('height', String(alto));
      };
      poner(mapa, construirMapa({ ancho, alto, radio, borde, suavizado, curvatura, resolucion }));
      if (o.escarcha > 0 || o.grano > 0) poner(ruido, construirEscarcha({ ancho, alto, radio, franja: borde + suavizado, resolucion }));
      if (o.bisel > 0) poner(canto, construirBrillo({ ancho, alto, radio, grosor: 1.5, resolucion: 1 }));
      return true;
    },
  };
}

/**
 * Mientras la hoja se mueve (sus transiciones o animaciones de entrada y salida) pone
 * data-vl-mov y el CSS quita el url() del backdrop-filter: el filtro SVG se recalcula en
 * cada frame y es lo caro (medido sin GPU: 14 fps abriendo el menú con él, 45 sin él;
 * el blur de 44px apenas cuesta). Al pararse vuelven el canto, la escarcha y el grano.
 */
export function vigilarMovimiento(el: HTMLElement): () => void {
  const enCurso = new Set<string>();
  const marcar = () => {
    if (enCurso.size) el.dataset.vlMov = '';
    else delete el.dataset.vlMov;
  };
  const empieza = (e: Event) => {
    if (e.target !== el) return;
    enCurso.add(e instanceof TransitionEvent ? `t:${e.propertyName}` : `a:${(e as AnimationEvent).animationName}`);
    marcar();
  };
  const acaba = (e: Event) => {
    if (e.target !== el) return;
    enCurso.delete(e instanceof TransitionEvent ? `t:${e.propertyName}` : `a:${(e as AnimationEvent).animationName}`);
    marcar();
  };
  const tipos: [string, (e: Event) => void][] = [
    ['transitionrun', empieza], ['transitionend', acaba], ['transitioncancel', acaba],
    ['animationstart', empieza], ['animationend', acaba], ['animationcancel', acaba],
  ];
  for (const [t, f] of tipos) el.addEventListener(t, f);
  return () => {
    for (const [t, f] of tipos) el.removeEventListener(t, f);
    delete el.dataset.vlMov;
  };
}
