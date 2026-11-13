import { useLayoutEffect, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

import {
  DIGITOS_BASE,
  MARGEN_CERO,
  type MargenSeguro,
  type MetricasDigitos,
} from '../layout/medidas';
import { pruebasActivas } from '../pruebas';

interface Refs {
  readonly menu: RefObject<HTMLElement | null>;
  readonly aviso: RefObject<HTMLElement | null>;
  readonly pie: RefObject<HTMLElement | null>;
  readonly sonda: RefObject<HTMLElement | null>;
}

function px(valor: string): number {
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : 0;
}

/** El borde del vidrio no entra en scrollHeight y, si se ignora, la caja se sale 2 px. */
function altoConBorde(nodo: HTMLElement): number {
  const estilo = getComputedStyle(nodo);
  return nodo.scrollHeight + px(estilo.borderTopWidth) + px(estilo.borderBottomWidth);
}

/**
 * Altos reales para `calcularLayout`. El menú, el aviso y el pie no se adivinan.
 * Los dígitos se miden una vez, cuando la fuente está lista.
 */
export function useMedidas(refs: Refs) {
  const [ventana, setVentana] = useState(() => ({ ancho: window.innerWidth, alto: window.innerHeight }));
  const [margenSeguro, setMargen] = useState<MargenSeguro>(MARGEN_CERO);
  const [altoMenu, setAltoMenu] = useState(320);
  const [altoAviso, setAltoAviso] = useState(0);
  const [altoPie, setAltoPie] = useState(40);
  const [digitos, setDigitos] = useState<MetricasDigitos>(DIGITOS_BASE);

  useLayoutEffect(() => {
    const alCambiar = () => {
      const ancho = window.innerWidth;
      const alto = window.innerHeight;
      flushSync(() => {
        setVentana((prev) => (prev.ancho === ancho && prev.alto === alto ? prev : { ancho, alto }));
      });
    };
    window.addEventListener('resize', alCambiar);
    const vista = new ResizeObserver(alCambiar);
    vista.observe(document.documentElement);
    // El reloj de Playwright dispara el resize después de leer las cajas.
    // Un pulso de 16 ms solo en la prueba: runFor(40) lo despierta y la
    // ventana ya tiene el tamaño nuevo. En uso normal no hay pulso.
    let pulso = 0;
    if (pruebasActivas()) {
      const repetir = () => {
        alCambiar();
        pulso = window.setTimeout(repetir, 16);
      };
      pulso = window.setTimeout(repetir, 16);
    }
    return () => {
      window.removeEventListener('resize', alCambiar);
      vista.disconnect();
      window.clearTimeout(pulso);
    };
  }, []);

  useLayoutEffect(() => {
    let vivo = true;
    void document.fonts.ready.then(() => {
      if (!vivo) return;
      const span = document.createElement('span');
      span.textContent = '00:00';
      span.style.cssText =
        'position:fixed;visibility:hidden;font:200 100px Manrope,sans-serif;letter-spacing:-0.035em;line-height:0.92;white-space:nowrap';
      document.body.appendChild(span);
      const anchoPorEm = span.offsetWidth / 100;
      const altoDigitosPorEm = span.offsetHeight / 100;
      span.textContent = 'pista';
      span.style.cssText = 'position:fixed;visibility:hidden;font:400 15px Manrope,sans-serif;line-height:1.25';
      const altoPista = span.offsetHeight * 2 + 8;
      span.remove();
      if (anchoPorEm > 0 && altoDigitosPorEm > 0) setDigitos({ anchoPorEm, altoDigitosPorEm, altoPista });
    });
    return () => {
      vivo = false;
    };
  }, []);

  useLayoutEffect(() => {
    const leer = () => {
      const sonda = refs.sonda.current;
      if (sonda) {
        const estilo = getComputedStyle(sonda);
        const siguiente = {
          arriba: px(estilo.paddingTop),
          derecha: px(estilo.paddingRight),
          abajo: px(estilo.paddingBottom),
          izquierda: px(estilo.paddingLeft),
        };
        setMargen((prev) =>
          prev.arriba === siguiente.arriba &&
          prev.derecha === siguiente.derecha &&
          prev.abajo === siguiente.abajo &&
          prev.izquierda === siguiente.izquierda
            ? prev
            : siguiente,
        );
      }
      const menu = refs.menu.current;
      if (menu) {
        const alto = altoConBorde(menu);
        setAltoMenu((prev) => (Math.abs(prev - alto) < 1 ? prev : alto));
      }
      const aviso = refs.aviso.current;
      const avisoAlto = aviso && getComputedStyle(aviso).display !== 'none' ? aviso.offsetHeight : 0;
      setAltoAviso((prev) => (prev === avisoAlto ? prev : avisoAlto));
      const pie = refs.pie.current;
      const pieAlto = pie && getComputedStyle(pie).display !== 'none' ? pie.offsetHeight : 0;
      setAltoPie((prev) => (pieAlto > 0 && Math.abs(prev - pieAlto) < 1 ? prev : pieAlto > 0 ? pieAlto : prev));
    };
    leer();
    const obs = new ResizeObserver(leer);
    for (const ref of [refs.menu, refs.aviso, refs.pie]) {
      if (ref.current) obs.observe(ref.current);
    }
    return () => {
      obs.disconnect();
    };
  });

  return { ancho: ventana.ancho, alto: ventana.alto, margenSeguro, altoMenu, altoAviso, altoPie, digitos };
}
