import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * El reloj ya está arriba, así que abrir el menú no debe empujarlo.
 * Si aun así se rozan, sube como mucho 12 px.
 */
export function useClockLift(
  appRef: RefObject<HTMLElement | null>,
  menuAbierto: boolean,
  ancha: boolean,
): number {
  const [alzado, setAlzado] = useState(0);

  useLayoutEffect(() => {
    const app = appRef.current;
    if (!app || !menuAbierto || !ancha) {
      setAlzado(0);
      return;
    }
    const medir = () => {
      const reloj = app.querySelector('.reloj');
      const hoja = app.querySelector('.sheet.open');
      if (!(reloj instanceof HTMLElement) || !(hoja instanceof HTMLElement)) {
        setAlzado(0);
        return;
      }
      const solape = reloj.getBoundingClientRect().bottom + 12 - hoja.getBoundingClientRect().top;
      setAlzado(solape > 1 ? Math.min(12, solape) : 0);
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(app);
    return () => observer.disconnect();
  }, [appRef, menuAbierto, ancha]);

  return alzado;
}
