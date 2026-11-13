import { JAR_ASPECT, JAR_FOOT_Y } from '../frasco/geometria';
import { caja, cajaNube, frascoDesdeArriba, frascoEn, seSolapan, type Caja } from './cajas';
import {
  AIRE,
  ALTO_CORTO,
  ALTO_FRASCO_SE_DESVANECE,
  ALTO_SIN_SCROLL,
  ANCHO_ANCHA,
  ANCHO_ANCHA_CORTA,
  AVISO_ANCHO,
  AVISO_BORDE,
  AVISO_ESCENA,
  AVISO_HOLGURA,
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
  MENU_HUECO_ANCHA,
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

/** Abajo a la izquierda, a 12 px del borde y del pie. El CSS pinta esa misma caja. */
function avisoEnEsquina(e: EntradaLayout, pie: Caja): Caja {
  if (e.altoAviso <= 0) return caja(0, e.alto + FUERA, 0, 0);
  const w = Math.min(AVISO_ANCHO, Math.max(0, e.ancho - AVISO_BORDE * 2));
  return caja(AVISO_BORDE, pie.y - AVISO_HOLGURA - e.altoAviso, w, e.altoAviso);
}

/** Menos de `holgura` px entre las cajas, o un cruce. El barrido usa el mismo hueco. */
function cerca(a: Caja, b: Caja, holgura: number): boolean {
  return seSolapan(caja(a.x - holgura, a.y - holgura, a.w + holgura * 2, a.h + holgura * 2), b);
}

/**
 * En ancha alta el aviso no se mueve. Si solo roza el pie del frasco, el frasco
 * sube ese poco. Si lo tapa de lado, el frasco se aparta o se encoge.
 */
function apartarFrasco(frasco: Caja, aviso: Caja, topeX: number): Caja {
  if (aviso.w <= 1 || !cerca(frasco, aviso, AVISO_ESCENA)) return frasco;
  const suelo = aviso.y - AVISO_ESCENA;
  const subida = frasco.y + frasco.h - suelo;
  if (subida > 0 && subida <= frasco.h * 0.15 && frasco.y - subida >= 0) {
    return caja(frasco.x, frasco.y - subida, frasco.w, frasco.h);
  }
  const x = aviso.x + aviso.w + AVISO_ESCENA;
  const hueco = topeX - x;
  if (hueco >= frasco.w) return caja(x, frasco.y, frasco.w, frasco.h);
  if (hueco >= frasco.w * 0.7) {
    const ancho = hueco;
    const alto = ancho / JAR_ASPECT;
    const pieY = frasco.y + frasco.h * JAR_FOOT_Y;
    return caja(x, pieY - alto * JAR_FOOT_Y, ancho, alto);
  }
  const alto = Math.min(frasco.h, Math.max(0, suelo));
  const ancho = alto * JAR_ASPECT;
  const centro = Math.min(frasco.x + frasco.w / 2, topeX - ancho / 2);
  return caja(centro - ancho / 2, suelo - alto, ancho, alto);
}

/** En horizontal bajo, frasco y reloj se reparten el hueco que queda encima del aviso. */
function escenaSobreAviso(
  e: EntradaLayout,
  frasco: Caja,
  reloj: Caja,
  aviso: Caja,
  columnaX: number,
): { frasco: Caja; reloj: Caja } {
  const suelo = aviso.y - AVISO_ESCENA;
  const techo = e.margenSeguro.arriba;
  const margen = margenAncho(e.ancho);
  const anchoTope = Math.max(0, columnaX - AIRE - margen);
  let alto = Math.min(frasco.h, Math.max(0, suelo - techo));
  let ancho = alto * JAR_ASPECT;
  if (ancho > anchoTope) {
    ancho = anchoTope;
    alto = ancho / JAR_ASPECT;
  }
  const centro = Math.min(frasco.x + frasco.w / 2, columnaX - AIRE - ancho / 2);
  const puesto = caja(Math.max(margen, centro - ancho / 2), Math.max(techo, suelo - alto), ancho, alto);
  const ry = Math.min(puesto.y + RELOJ_TOP * puesto.h, Math.max(techo, suelo - reloj.h));
  return { frasco: puesto, reloj: { ...reloj, y: ry } };
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
  const techoColumna = e.margenSeguro.arriba;
  const sueloColumna = botonMenu.y - 8;
  let relojY = e.relojCentrado
    ? techoColumna + Math.max(0, (sueloColumna - techoColumna - relojBase.h) / 2)
    : relojBase.y;
  let relojVisible = true;
  const huecoBajo = () => sueloColumna - (relojY + relojBase.h + MENU_HUECO_ANCHA);
  let altoMenu = Math.min(e.altoMenu, Math.max(0, huecoBajo()));
  const menuEnBanda = () => {
    const banda = sueloColumna - (relojY + relojBase.h);
    const hueco = Math.max(MENU_HUECO_ANCHA, (banda - altoMenu) / 2);
    return relojY + relojBase.h + hueco;
  };
  let menuY = e.relojCentrado ? sueloColumna - altoMenu : menuEnBanda();
  if (e.menuAbierto && e.altoMenu > huecoBajo() + 1) {
    const falta = e.altoMenu - huecoBajo();
    const tope = e.relojCentrado ? relojY - techoColumna : Math.min(m, relojY - m);
    relojY -= Math.max(0, Math.min(falta, tope));
    altoMenu = Math.min(e.altoMenu, Math.max(0, huecoBajo()));
    menuY = e.relojCentrado ? sueloColumna - altoMenu : menuEnBanda();
    if (e.alto < ALTO_CORTO && e.altoMenu > altoMenu + 1) {
      relojVisible = false;
      const techo = e.margenSeguro.arriba + 8;
      const suelo = pie.y - 8;
      altoMenu = Math.min(e.altoMenu, Math.max(0, suelo - techo));
      menuY = techo;
    }
  }
  const menuW = Math.min(MENU_ANCHO_ANCHA, columnaW);
  const menu = caja(
    columnaX + (columnaW - menuW) / 2,
    e.menuAbierto ? menuY : e.alto + FUERA,
    menuW,
    altoMenu,
  );
  const aviso = avisoEnEsquina(e, pie);
  let reloj = { ...relojBase, y: relojY };
  let frascoPuesto = frasco;
  if (e.alto < ALTO_CORTO && aviso.h > 1) {
    const escena = escenaSobreAviso(e, frasco, reloj, aviso, columnaX);
    frascoPuesto = escena.frasco;
    reloj = escena.reloj;
  } else {
    const arriba = frasco.y;
    frascoPuesto = apartarFrasco(frasco, aviso, columnaX);
    const subida = arriba - frascoPuesto.y;
    if (
      subida > 0 &&
      Math.abs(frascoPuesto.x - frasco.x) < 0.5 &&
      Math.abs(frascoPuesto.h - frasco.h) < 0.5
    ) {
      reloj = { ...reloj, y: reloj.y - subida };
    }
  }
  return {
    ancha: true,
    frasco: frascoPuesto,
    nube: cajaNube(frascoPuesto),
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
  const avisoW = avisoH > 0 ? Math.max(0, e.ancho - AVISO_BORDE * 2) : 0;
  const botonY = e.alto - e.margenSeguro.abajo - m - BOTON;
  const avisoY = avisoH > 0 ? Math.min(pie.y, botonY) - avisoH : pie.y;
  const aviso = caja(AVISO_BORDE, avisoY, avisoW, avisoH);
  const zonaBottom = (avisoH > 0 ? avisoY : pie.y) - m;
  return { pie, aviso, zonaBottom };
}

function jarraEnHueco(
  e: EntradaLayout,
  y: number,
  hueco: number,
  minimo: number,
): { frasco: Caja; visible: boolean } {
  const anchoMax = e.ancho * FRASCO_ANCHO_ESTRECHA;
  let alto = Math.min(Math.max(0, hueco) * FRASCO_HUECO, e.alto * FRASCO_ALTO_ESTRECHA);
  const probe = frascoDesdeArriba(e.ancho / 2, y, alto, anchoMax);
  alto = probe.h;
  const cabe = alto + 0.5 >= minimo && hueco + 0.5 >= minimo;
  if (!cabe && e.menuAbierto && e.alto < ALTO_FRASCO_SE_DESVANECE) {
    return {
      frasco: frascoDesdeArriba(e.ancho / 2, y, Math.max(0, hueco * FRASCO_HUECO), anchoMax),
      visible: false,
    };
  }
  if (!cabe && hueco >= minimo) alto = minimo;
  return { frasco: frascoDesdeArriba(e.ancho / 2, y, alto, anchoMax), visible: true };
}

function relojEstrechoCerrado(e: EntradaLayout): number {
  return estrecho({ ...e, menuAbierto: false, altoAviso: 0 }).reloj.y;
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
    const libre = Math.max(0, zonaH - frasco.h - relojH);
    const separacion = Math.max(SEPARACION_RELOJ, libre / 3);
    const grupo = frasco.h + separacion + relojH;
    const inicio = zonaTop + Math.max(0, (zonaH - grupo) / 2);
    const vuela = Math.max(0, inicio - cajaNube({ ...frasco, y: inicio }).y);
    const visual = vuela + grupo;
    let y = zonaTop + vuela + Math.max(0, (zonaH - visual) / 2);
    y = Math.min(y, zonaTop + Math.max(0, zonaH - grupo));
    y = Math.max(zonaTop, y);
    const puesto = { ...frasco, y };
    const reloj = caja((e.ancho - relojW) / 2, puesto.y + puesto.h + separacion, relojW, relojH);
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
  const margenPie = e.margenSeguro.abajo + MENU_BAJO_RELOJ;
  const altoLibre = e.alto - margenPie - m - relojH - SEPARACION_MENU - e.margenSeguro.arriba;
  const altoMenu = Math.min(e.altoMenu, e.alto >= ALTO_SIN_SCROLL ? Math.max(0, altoLibre) : topeDiseno);
  const menuY = e.alto - margenPie - altoMenu;
  const propuesto = menuY - SEPARACION_MENU - relojH;
  const relojY = Math.min(propuesto, relojEstrechoCerrado(e));
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
