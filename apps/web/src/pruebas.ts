/**
 * Gancho de pruebas. Solo existe si Playwright pone `window.__HG_PRUEBA__`
 * antes de cargar. En uso normal no se instala nada y el reloj no lo consulta.
 */

export interface CajaPrueba {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface CajasPrueba {
  readonly frasco: CajaPrueba;
  readonly reloj: CajaPrueba;
  readonly menu: CajaPrueba;
  readonly botonMenu: CajaPrueba;
  readonly nube: CajaPrueba;
}

export interface HgPrueba {
  fijarAngulo: (grados: number) => void;
  cajas: CajasPrueba | null;
}

declare global {
  interface Window {
    __HG_PRUEBA__?: boolean;
    __hg?: HgPrueba;
  }
}

type OyenteAngulo = (radianes: number) => void;

const oyentes = new Set<OyenteAngulo>();

export function pruebasActivas(): boolean {
  return typeof window !== 'undefined' && window.__HG_PRUEBA__ === true;
}

/** No hace nada si la bandera no estaba puesta antes de cargar. */
export function instalarPruebas(): void {
  if (!pruebasActivas()) return;
  window.__hg = {
    fijarAngulo(grados: number) {
      const radianes = (grados * Math.PI) / 180;
      for (const oyente of oyentes) oyente(radianes);
    },
    cajas: null,
  };
}

export function alFijarAngulo(oyente: OyenteAngulo): () => void {
  if (!pruebasActivas()) return () => undefined;
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function publicarCajas(cajas: CajasPrueba): void {
  if (!pruebasActivas() || !window.__hg) return;
  window.__hg.cajas = cajas;
}
