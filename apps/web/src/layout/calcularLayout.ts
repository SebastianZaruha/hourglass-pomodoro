import { caja, cajaNube, frascoDesdeArriba, frascoEn, type Caja } from './cajas';
import {
  AIRE,
  ALTO_CORTO,
  ALTO_FRASCO_SE_DESVANECE,
  ALTO_SIN_SCROLL,
  ANCHO_ANCHA,
  ANCHO_ANCHA_CORTA,
  AVISO_HUECO,
  AVISO_MAX,
  AVISO_MIN,
  BORDE_PIE,
  BOTON,
  COLUMNA_X,
  FRASCO_ALTO_ANCHA,
  FRASCO_ALTO_ESTRECHA,
  FRASCO_ANCHO_ANCHA,
  FRASCO_ANCHO_ESTRECHA,
  FRASCO_BASE,
  FRASCO_HUECO,
  FRASCO_MIN_ABIERTO,
  FRASCO_MIN_CERRADO,
  FRASCO_X,
  FUERA,
  HORA_BAJA,
  HORA_FRACCION_ANCHA,
  HORA_FRACCION_ESTRECHA,
  HORA_MAX_ANCHA,
  HORA_MAX_ESTRECHA,
  HORA_MIN_ANCHA,
  HORA_MIN_ESTRECHA,
  HORA_SUELO,
  HORA_TOPE_ALTO,
  MARGEN_ESTRECHO,
  MENU_ANCHO_ANCHA,
  MENU_ANCHO_ESTRECHA,
  MENU_BAJO_RELOJ,
  MENU_FRACCION,
  MENU_MARGEN_X,
  MENU_TOPE,
  RATIO_ANCHA,
  RELOJ_TOP,
  SEPARACION_MENU,
  SEPARACION_RELOJ,
  clamp,
  margenAncho,
  type EntradaLayout,
  type MetricasDigitos,
} from './medidas';

export type { Caja } from './cajas';
export { seSolapan } from './cajas';
export type { EntradaLayout, MetricasDigitos } from './medidas';
export { entradaDe } from './medidas';

export interface Layout {
  readonly ancha: boolean;
  readonly frasco: Caja;
  readonly nube: Caja;
  readonly reloj: Caja;
  readonly menu: Caja;
  readonly botonMenu: Caja;
  readonly pie: Caja;
  readonly aviso: Caja;
  readonly horaPx: number;
  readonly relojVisible: boolean;
  readonly frascoVisible: boolean;
  /** El menú hace scroll solo por debajo de 600 px, si el contenido no cabe. */
  readonly menuConScroll: boolean;
}

function altoBloque(px: number, digitos: MetricasDigitos): number {
  return px * digitos.altoDigitosPorEm + digitos.altoPista;
}

function frascoAncho(ancho: number, alto: number): Caja {
  return frascoEn(ancho * FRASCO_X, alto * FRASCO_BASE, alto * FRASCO_ALTO_ANCHA, ancho * FRASCO_ANCHO_ANCHA);
}

/** El reloj a 64 px cabe en la columna con 32 px de aire respecto al frasco. */
export function cabeReloj(e: EntradaLayout): boolean {
  const m = margenAncho(e.ancho);
  const frasco = frascoAncho(e.ancho, e.alto);
  const columnaX = e.ancho * COLUMNA_X;
  const columnaW = e.ancho - m - columnaX;
  const anchoDigitos = HORA_MIN_ANCHA * e.digitos.anchoPorEm;
  if (columnaW <= 0 || anchoDigitos + AIRE * 2 > columnaW) return false;
  return columnaX >= frasco.x + frasco.w + AIRE;
}

/**
 * Ancha si el ratio llega a 1,2 y el reloj cabe.
 * Hace falta además W ≥ 900, salvo el móvil horizontal de la tabla (844×390),
 * que se queda ancha desde 720 px para que el reloj pueda desvanecerse.
 */
export function esAncha(e: EntradaLayout): boolean {
  if (e.alto <= 0 || e.ancho / e.alto < RATIO_ANCHA) return false;
  if (!cabeReloj(e)) return false;
  if (e.ancho >= ANCHO_ANCHA) return true;
  return e.alto < ALTO_CORTO && e.ancho >= ANCHO_ANCHA_CORTA;
}

function horaAncha(e: EntradaLayout, columnaW: number): number {
  const tope = (columnaW - AIRE * 2) / Math.max(0.01, e.digitos.anchoPorEm);
  return Math.min(clamp(HORA_MIN_ANCHA, e.alto * HORA_FRACCION_ANCHA, HORA_MAX_ANCHA), tope);
}

function cajaPie(e: EntradaLayout, margen: number): Caja {
  const lado = BOTON + margen + 8;
  const w = Math.max(0, e.ancho - lado * 2);
  const y = e.alto - e.margenSeguro.abajo - BORDE_PIE - e.altoPie;
  return caja((e.ancho - w) / 2, y, w, e.altoPie);
}

/** Entre 320 y 440 px. Si el hueco es menor, el hueco manda. */
function anchoComodo(espacio: number): number {
  if (espacio >= AVISO_MIN) return Math.min(AVISO_MAX, espacio);
  return Math.max(0, espacio);
}

/**
 * En la columna, justo bajo el reloj. Si no cabe sobre el pie, el reloj sube.
 * Devuelve la y del reloj ya corregida.
 */
function colocarAvisoAncho(
  e: EntradaLayout,
  reloj: Caja,
  boton: Caja,
  pie: Caja,
  relojVisible: boolean,
): { yReloj: number; aviso: Caja } {
  if (e.altoAviso <= 0) return { yReloj: reloj.y, aviso: caja(0, e.alto + FUERA, 0, 0) };
  const m = margenAncho(e.ancho);
  const columnaX = e.ancho * COLUMNA_X;
  const columnaW = Math.max(0, e.ancho - m - columnaX);
  const w = anchoComodo(columnaW);
  const x = columnaX + Math.max(0, columnaW - w) / 2;
  const suelo = Math.min(pie.y, boton.y);
  const techo = e.margenSeguro.arriba;
  let yReloj = reloj.y;
  if (relojVisible) {
    const bloque = reloj.h + AVISO_HUECO + e.altoAviso;
    if (yReloj + bloque > suelo) yReloj = Math.max(techo, suelo - bloque);
  }
  const bajo = (relojVisible ? yReloj + reloj.h : techo) + AVISO_HUECO;
  const y = bajo + e.altoAviso <= suelo ? bajo : Math.max(0, suelo - e.altoAviso);
  return { yReloj, aviso: caja(x, y, w, e.altoAviso) };
}

function amplio(e: EntradaLayout): Layout {
  const m = margenAncho(e.ancho);
  const frasco = frascoAncho(e.ancho, e.alto);
  const columnaX = e.ancho * COLUMNA_X;
  const columnaW = e.ancho - m - columnaX;
  const botonMenu = caja(e.ancho - m - BOTON, e.alto - e.margenSeguro.abajo - m - BOTON, BOTON, BOTON);
  const pie = cajaPie(e, m);
  const horaPx = horaAncha(e, columnaW);
  const relojBase = caja(columnaX, frasco.y + RELOJ_TOP * frasco.h, columnaW, altoBloque(horaPx, e.digitos));
  let relojY = relojBase.y;
  let relojVisible = true;
  const huecoBajo = () => botonMenu.y - 8 - (relojY + relojBase.h + MENU_BAJO_RELOJ);
  let altoMenu = Math.min(e.altoMenu, Math.max(0, huecoBajo()));
  let menuY = relojY + relojBase.h + MENU_BAJO_RELOJ;
  if (e.menuAbierto && e.altoMenu > huecoBajo() + 1) {
    relojY -= Math.max(0, Math.min(e.altoMenu - huecoBajo(), m, relojY - m));
    altoMenu = Math.min(e.altoMenu, Math.max(0, huecoBajo()));
    menuY = relojY + relojBase.h + MENU_BAJO_RELOJ;
    if (e.alto < ALTO_CORTO && e.altoMenu > altoMenu + 1) {
      relojVisible = false;
      const techo = e.margenSeguro.arriba + 8;
      const suelo = pie.y - 8;
      altoMenu = Math.min(e.altoMenu, Math.max(0, suelo - techo));
      menuY = techo;
    }
  }
  const menuW = Math.min(MENU_ANCHO_ANCHA, columnaW);
  const menu = caja(columnaX + (columnaW - menuW) / 2, e.menuAbierto ? menuY : e.alto + FUERA, menuW, altoMenu);
  const colocado = colocarAvisoAncho(e, { ...relojBase, y: relojY }, botonMenu, pie, relojVisible);
  const reloj = { ...relojBase, y: colocado.yReloj };
  const aviso = colocado.aviso;
  return {
    ancha: true,
    frasco,
    nube: cajaNube(frasco),
    reloj,
    menu,
    botonMenu,
    pie,
    aviso,
    horaPx,
    relojVisible,
    frascoVisible: true,
    menuConScroll: e.alto < ALTO_SIN_SCROLL && e.altoMenu > altoMenu + 1,
  };
}

function horaEstrecha(e: EntradaLayout): number {
  const topeAlto = e.alto * HORA_TOPE_ALTO;
  const topeAncho = (e.ancho - MARGEN_ESTRECHO * 2) / Math.max(0.01, e.digitos.anchoPorEm);
  const cerrada = Math.min(
    clamp(HORA_MIN_ESTRECHA, e.ancho * HORA_FRACCION_ESTRECHA, HORA_MAX_ESTRECHA),
    topeAlto,
    topeAncho,
  );
  if (!e.menuAbierto) return cerrada;
  const suelo = Math.min(HORA_SUELO, cerrada);
  return Math.max(suelo, cerrada * (1 - HORA_BAJA));
}

function pilaEstrecha(e: EntradaLayout): { pie: Caja; aviso: Caja; zonaBottom: number } {
  const m = MARGEN_ESTRECHO;
  const pie = cajaPie(e, m);
  const avisoH = e.altoAviso;
  const espacio = Math.max(0, e.ancho - m * 2);
  const avisoW = avisoH > 0 ? anchoComodo(espacio) : 0;
  const botonY = e.alto - e.margenSeguro.abajo - m - BOTON;
  const avisoY = avisoH > 0 ? Math.min(pie.y, botonY) - avisoH : pie.y;
  const aviso = caja((e.ancho - avisoW) / 2, avisoY, avisoW, avisoH);
  const zonaBottom = (avisoH > 0 ? avisoY : pie.y) - m;
  return { pie, aviso, zonaBottom };
}

function jarraEnHueco(e: EntradaLayout, y: number, hueco: number, minimo: number): { frasco: Caja; visible: boolean } {
  const anchoMax = e.ancho * FRASCO_ANCHO_ESTRECHA;
  let alto = Math.min(Math.max(0, hueco) * FRASCO_HUECO, e.alto * FRASCO_ALTO_ESTRECHA);
  const probe = frascoDesdeArriba(e.ancho / 2, y, alto, anchoMax);
  alto = probe.h;
  const cabe = alto + 0.5 >= minimo && hueco + 0.5 >= minimo;
  if (!cabe && e.menuAbierto && e.alto < ALTO_FRASCO_SE_DESVANECE) {
    return { frasco: frascoDesdeArriba(e.ancho / 2, y, Math.max(0, hueco * FRASCO_HUECO), anchoMax), visible: false };
  }
  if (!cabe && hueco >= minimo) alto = minimo;
  return { frasco: frascoDesdeArriba(e.ancho / 2, y, alto, anchoMax), visible: true };
}

function estrecho(e: EntradaLayout): Layout {
  const m = MARGEN_ESTRECHO;
  const botonMenu = caja(e.ancho - m - BOTON, e.alto - e.margenSeguro.abajo - m - BOTON, BOTON, BOTON);
  const { pie, aviso, zonaBottom } = pilaEstrecha(e);
  const horaPx = horaEstrecha(e);
  const relojH = altoBloque(horaPx, e.digitos);
  const relojW = e.ancho - m * 2;
  const topeDiseno = Math.min(e.alto * MENU_FRACCION, MENU_TOPE);
  const menuW = Math.min(Math.max(0, e.ancho - MENU_MARGEN_X), MENU_ANCHO_ESTRECHA);
  const menuX = (e.ancho - menuW) / 2;
  if (!e.menuAbierto) {
    const zonaTop = e.margenSeguro.arriba;
    const zonaH = Math.max(0, zonaBottom - zonaTop);
    const hueco = zonaH - relojH - SEPARACION_RELOJ;
    const { frasco, visible } = jarraEnHueco(e, zonaTop, hueco, e.alto * FRASCO_MIN_CERRADO);
    const grupo = frasco.h + SEPARACION_RELOJ + relojH;
    const inicio = zonaTop + Math.max(0, (zonaH - grupo) / 2);
    const puesto = { ...frasco, y: inicio };
    const reloj = caja((e.ancho - relojW) / 2, puesto.y + puesto.h + SEPARACION_RELOJ, relojW, relojH);
    const menu = caja(menuX, e.alto + FUERA, menuW, Math.min(e.altoMenu, topeDiseno));
    return {
      ancha: false,
      frasco: puesto,
      nube: cajaNube(puesto),
      reloj,
      menu,
      botonMenu,
      pie,
      aviso,
      horaPx,
      relojVisible: true,
      frascoVisible: visible,
      menuConScroll: false,
    };
  }
  const altoLibre = e.alto - e.margenSeguro.abajo - m - relojH - SEPARACION_MENU - e.margenSeguro.arriba;
  const altoMenu = Math.min(e.altoMenu, e.alto >= ALTO_SIN_SCROLL ? Math.max(0, altoLibre) : topeDiseno);
  const menuY = e.alto - e.margenSeguro.abajo - altoMenu;
  const relojY = menuY - SEPARACION_MENU - relojH;
  const reloj = caja((e.ancho - relojW) / 2, relojY, relojW, relojH);
  const hueco = relojY - SEPARACION_RELOJ - e.margenSeguro.arriba;
  const { frasco, visible } = jarraEnHueco(e, e.margenSeguro.arriba, hueco, e.alto * FRASCO_MIN_ABIERTO);
  const inicio = e.margenSeguro.arriba + Math.max(0, (hueco - frasco.h) / 2);
  const puesto = visible || frasco.h > 0 ? { ...frasco, y: inicio } : frasco;
  return {
    ancha: false,
    frasco: puesto,
    nube: cajaNube(puesto),
    reloj,
    menu: caja(menuX, menuY, menuW, altoMenu),
    botonMenu,
    pie,
    aviso,
    horaPx,
    relojVisible: true,
    frascoVisible: visible,
    menuConScroll: e.alto < ALTO_SIN_SCROLL && e.altoMenu > altoMenu + 1,
  };
}

/** Colocación única. No conoce el tema. Los altos llegan medidos. */
export function calcularLayout(e: EntradaLayout): Layout {
  return esAncha(e) ? amplio(e) : estrecho(e);
}
