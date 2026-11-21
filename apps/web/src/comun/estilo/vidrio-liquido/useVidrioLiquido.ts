import { useId, useLayoutEffect, useState, type RefObject } from 'react';
import { crearFiltro, vigilarMovimiento } from './filtro';
import { vigilarTinta } from './tinta';

export interface OpcionesVidrioLiquido {
  /** Cuánto se doblan los bordes, en px (Depth). Por defecto 30. */
  profundidad?: number;
  /** Anchura del anillo de refracción sobre el borde, en px (Splay). Por defecto 18. */
  borde?: number;
  /** Cuánto se alarga la caída hacia el centro, en px (Feather). Por defecto 16. */
  suavizado?: number;
  /** Forma del bisel: más alto = borde más marcado y centro más limpio (Curvature). Por defecto 1.8. */
  curvatura?: number;
  /** Escarcha: cuánto tiembla la superficie, en px (ruido de media cero tras el blur). 0 = liso. Por defecto 7. */
  escarcha?: number;
  /** Grano de brillo neutro, 0–1 (media cero: no aclara ni oscurece). Por defecto 0.07. */
  grano?: number;
  /** Brillo del canto, 0–1: copia más clara y saturada del propio fondo. 0 = sin canto. Por defecto 0.8. */
  bisel?: number;
  /** Radio de las esquinas en px. Si no se pasa, se lee el border-radius del elemento (o 28). */
  radio?: number;
  /** Tamaño de los mapas respecto al elemento. 0.5 = mitad (más barato, se ve igual). */
  resolucion?: number;
  /**
   * Qué hacer en navegadores sin refracción (Safari, Firefox, iOS):
   *  - 'desenfoque': el mismo vidrio pero sin doblar el borde, sin escarcha ni grano (por defecto).
   *  - 'app': no aplicar nada y dejar que mande la clase propia de la app (p. ej. .vidrio).
   */
  respaldo?: 'desenfoque' | 'app';
  /**
   * Tinta automática: mira la escena bajo la hoja y elige texto blanco u oscuro (y un
   * ajuste pequeño del brillo) para que el peor punto llegue a AA. Por defecto true.
   */
  tinta?: boolean;
  /** Para la tinta: selector de los hijos cuya zona se mira (p. ej. solo el texto de la pausa). */
  muestra?: string;
  /** Pon false para apagar el efecto sin desmontar nada. */
  activo?: boolean;
}


export type ModoVidrio = 'refraccion' | 'desenfoque' | 'app';

/**
 * ¿Puede este navegador usar un filtro SVG dentro de backdrop-filter?
 * Hoy solo Chromium (Chrome, Edge, Opera, Samsung Internet, WebView de Android).
 * `navigator.userAgentData` solo existe en Chromium; Chrome en iPhone es WebKit y no lo tiene.
 */
export function soportaRefraccion(): boolean {
  if (typeof window === 'undefined') return false;
  const chromium = 'userAgentData' in navigator;
  const backdrop = CSS.supports('backdrop-filter', 'blur(1px)');
  const menosTransparencia = matchMedia('(prefers-reduced-transparency: reduce)').matches;
  return chromium && backdrop && !menosTransparencia;
}

/**
 * Convierte el propio elemento (la hoja) en vidrio líquido.
 * Solo pinta el fondo: no toca posición, tamaño, transform, filter ni opacity.
 *
 * Uso:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useVidrioLiquido(ref);
 *   <div ref={ref} className="hoja vidrio-liquido">…</div>
 */
export function useVidrioLiquido(
  ref: RefObject<HTMLElement | null>,
  opciones: OpcionesVidrioLiquido = {},
): ModoVidrio {
  const {
    profundidad = 30,
    borde = 18,
    suavizado = 16,
    curvatura = 1.8,
    escarcha = 7,
    grano = 0.07,
    bisel = 0.8,
    radio,
    resolucion = 0.5,
    respaldo = 'desenfoque',
    tinta = true,
    muestra,
    activo = true,
  } = opciones;

  // Identificador único y válido para el filtro SVG (useId devuelve algo como «r1»).
  const idBase = 'vl-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [modo, setModo] = useState<ModoVidrio>(respaldo);

  // useLayoutEffect: así el atributo está puesto antes del primer pintado (sin parpadeo).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const refraccion = activo && soportaRefraccion();
    const modoActual: ModoVidrio = refraccion ? 'refraccion' : respaldo;
    el.dataset.vl = modoActual; // el CSS decide el aspecto según este atributo
    setModo(modoActual);
    if (!refraccion) {
      return () => {
        delete el.dataset.vl;
      };
    }

    // 1) Filtro SVG oculto en el <body> (ver filtro.ts para lo que hace cada paso).
    const { svg, filtro, medir } = crearFiltro({
      profundidad, borde, suavizado, curvatura, escarcha, grano, bisel, resolucion,
    });
    document.body.append(svg);

    // 2) Construye (o saca de la caché) los mapas para el tamaño real del elemento.
    let version = 0;
    const actualizar = () => {
      // offsetWidth/Height = tamaño de layout; no le afectan translateY ni el blur de entrada.
      const ancho = el.offsetWidth;
      const alto = el.offsetHeight;
      if (ancho < 2 || alto < 2) return; // oculto (display:none): esperamos al siguiente resize
      const r = radio ?? (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
      if (!medir(ancho, alto, r)) return;
      // Id nuevo en cada cambio: obliga al navegador a no reutilizar el filtro viejo.
      filtro.id = `${idBase}-${++version}`;
      el.style.setProperty('--vl-filtro', `url(#${filtro.id})`);
    };
    actualizar();

    // 3) Si cambia el tamaño (girar el móvil, redimensionar), rehacemos los mapas
    //    con un pequeño retraso para no recalcularlos en cada píxel del arrastre.
    let espera = 0;
    const observador = new ResizeObserver(() => {
      clearTimeout(espera);
      espera = window.setTimeout(actualizar, 120);
    });
    observador.observe(el);

    // 4) Mientras la hoja entra o sale, sin filtro SVG (ver vigilarMovimiento): 60 fps.
    const pararMovimiento = vigilarMovimiento(el);

    // 5) Limpieza al desmontar o al cambiar opciones.
    return () => {
      observador.disconnect();
      pararMovimiento();
      clearTimeout(espera);
      svg.remove();
      el.style.removeProperty('--vl-filtro');
      delete el.dataset.vl;
    };
  }, [ref, idBase, profundidad, borde, suavizado, curvatura, escarcha, grano, bisel, radio, resolucion, respaldo, activo]);

  // Tinta: en todos los navegadores (no depende del filtro SVG).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !activo || !tinta) return;
    return vigilarTinta(el, muestra);
  }, [ref, activo, tinta, muestra]);

  return modo;
}
