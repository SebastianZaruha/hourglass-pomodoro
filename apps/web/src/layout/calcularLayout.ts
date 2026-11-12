import { JAR_ASPECT, JAR_FOOT_Y, JAR_TOP_BOX } from '../frasco/jarTabla';

export interface Caja {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Layout {
  readonly ancha: boolean;
  readonly frasco: Caja;
  readonly nube: Caja;
  readonly reloj: Caja;
  readonly menu: Caja;
  readonly botonMenu: Caja;
}

export function esAncha(ancho: number, alto: number, rem = 16): boolean {
  return ancho >= rem * 46 && ancho > alto * 1.05;
}

function caja(x: number, y: number, w: number, h: number): Caja {
  return { x, y, w, h };
}

/** El borde de abajo de la nube cae sobre el cristal, un poco dentro del bulbo. */
export function cajaNube(frasco: Caja): Caja {
  const ancho = frasco.w * 1.72;
  const alto = ancho * (438 / 1100);
  const bulbo = JAR_TOP_BOX[1] + 0.4 * (JAR_TOP_BOX[3] - JAR_TOP_BOX[1]);
  return caja(frasco.x + frasco.w / 2 - ancho / 2, frasco.y + frasco.h * bulbo - alto, ancho, alto);
}

function frascoEn(pieX: number, pieY: number, altoMax: number, anchoMax: number): Caja {
  let alto = altoMax;
  let ancho = alto * JAR_ASPECT;
  if (ancho > anchoMax) {
    ancho = anchoMax;
    alto = ancho / JAR_ASPECT;
  }
  return caja(pieX - ancho * 0.5, pieY - alto * JAR_FOOT_Y, ancho, alto);
}

function relajar(reloj: Caja, menu: Caja, ancha: boolean): Caja {
  if (!ancha) return reloj;
  const solape = reloj.y + reloj.h + 16 - menu.y;
  if (solape <= 0) return reloj;
  // El reloj ya vive arriba: si el menú lo rozara, solo sube un pelo.
  const alzado = Math.min(12, solape);
  return { ...reloj, y: reloj.y - alzado };
}

/**
 * Colocación única. No conoce el tema.
 * En ancho el frasco no se mueve: el menú queda debajo de la hora.
 * En estrecho, abrir el menú sube el frasco y la hora para no taparlos.
 */
export function calcularLayout(ancho: number, alto: number, menuAbierto: boolean, rem = 16): Layout {
  const ancha = esAncha(ancho, alto, rem);
  if (ancha) {
    const botonMenu = caja(ancho - rem * 0.9 - 48, alto - rem * 1.15 - 44, 48, 44);
    return amplio(ancho, alto, menuAbierto, botonMenu);
  }
  return estrecho(ancho, alto, menuAbierto);
}

function amplio(ancho: number, alto: number, menuAbierto: boolean, botonMenu: Caja): Layout {
  const frasco = frascoEn(ancho * 0.3, alto * 0.8, alto * 0.7, ancho * 0.34);
  // La caja incluye la hora y la pista, para que el menú empiece debajo.
  const relojAlto = Math.max(168, frasco.h * 0.34);
  const relojBase = caja(ancho * 0.56, frasco.y + frasco.h * 0.02, ancho * 0.36, relojAlto);
  const debajo = relojBase.y + relojBase.h + 18;
  const menuAlto = Math.min(alto * 0.42, Math.max(200, alto - debajo - 20));
  const menu = caja(relojBase.x, menuAbierto ? debajo : alto + 24, relojBase.w, menuAlto);
  const reloj = relajar(relojBase, menu, menuAbierto);
  return { ancha: true, frasco, nube: cajaNube(frasco), reloj, menu, botonMenu };
}

function estrecho(ancho: number, alto: number, menuAbierto: boolean): Layout {
  const borde = 22;
  const menuAlto = Math.min(364, Math.max(328, Math.round(alto * 0.42)));
  const pie = 48;
  const reserva = menuAbierto ? menuAlto + borde : pie;
  const relojAlto = Math.min(128, Math.max(108, Math.round(alto * 0.15)));
  const reloj = caja(16, alto - reserva - relojAlto, ancho - 32, relojAlto);
  const botonMenu = caja(ancho - 14 - 36, alto - 40, 36, 28);
  const techo = 12;
  const hueco = Math.max(64, reloj.y - techo);
  const frasco = frascoEn(ancho * 0.5, techo + hueco * 0.84, hueco * 0.54, ancho * 0.4);
  const menu = caja(10, menuAbierto ? alto - menuAlto - borde : alto + 24, ancho - 20, menuAlto);
  return { ancha: false, frasco, nube: cajaNube(frasco), reloj, menu, botonMenu };
}

export function seSolapan(a: Caja, b: Caja): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
