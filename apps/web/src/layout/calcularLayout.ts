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
 * Colocación única. No conoce el tema: cambiar de escena no mueve nada.
 * En estrecho el menú se superpone; el frasco no cambia de tamaño ni de sitio.
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
  const relojBase = caja(
    ancho * 0.56,
    frasco.y + frasco.h * 0.05,
    ancho * 0.36,
    Math.max(78, frasco.h * 0.2),
  );
  const menuAlto = Math.min(alto * 0.52, 540);
  const menu = caja(
    relojBase.x,
    menuAbierto ? relojBase.y + relojBase.h + 20 : alto + 24,
    relojBase.w,
    menuAlto,
  );
  const reloj = relajar(relojBase, menu, menuAbierto);
  return { ancha: true, frasco, nube: cajaNube(frasco), reloj, menu, botonMenu };
}

function estrecho(ancho: number, alto: number, menuAbierto: boolean): Layout {
  // Franja de abajo: el pie en una sola línea y el botón del menú a su derecha.
  const banda = 36;
  const relojAlto = Math.min(112, Math.max(92, alto * 0.14));
  const reloj = caja(10, alto - banda - relojAlto - 2, ancho - 20, relojAlto);
  const botonMenu = caja(ancho - 8 - 36, alto - banda + 4, 36, 28);
  const techo = 8;
  const hueco = Math.max(80, reloj.y - techo - 6);
  const frasco = frascoEn(ancho * 0.5, techo + hueco * 0.96, hueco * 0.9, ancho * 0.72);
  const tope = reloj.y - 6;
  const menuAlto = Math.min(alto * 0.42, 360, Math.max(140, tope - 40));
  const menu = caja(10, menuAbierto ? tope - menuAlto : alto + 24, ancho - 20, menuAlto);
  return { ancha: false, frasco, nube: cajaNube(frasco), reloj, menu, botonMenu };
}

export function seSolapan(a: Caja, b: Caja): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
