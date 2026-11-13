import { useEffect, useState } from 'react';

/**
 * Un solo ocultado para el botón del menú y el pie.
 * Con ratón, 3 s quieto o al salir el puntero de la ventana.
 * En táctil, 4 s después del toque.
 */
export function useAutoocultar(menuAbierto: boolean): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (menuAbierto) return;
    const tactil = window.matchMedia('(hover: none)').matches;
    const espera = tactil ? 4_000 : 3_000;
    let timer = window.setTimeout(() => setVisible(false), espera);
    const mostrar = () => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), espera);
    };
    const salir = () => setVisible(false);
    window.addEventListener('pointermove', mostrar);
    window.addEventListener('pointerdown', mostrar);
    document.documentElement.addEventListener('pointerleave', salir);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', mostrar);
      window.removeEventListener('pointerdown', mostrar);
      document.documentElement.removeEventListener('pointerleave', salir);
    };
  }, [menuAbierto]);

  return visible;
}
