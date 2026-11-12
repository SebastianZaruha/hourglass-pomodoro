import { useEffect, useState } from 'react';

/** El botón del menú aparece con el puntero y se esconde tras 3 s quieto. */
export function useBotonMenu(menuAbierto: boolean, pausado: boolean): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (menuAbierto || pausado) return;
    let timer = window.setTimeout(() => setVisible(false), 3000);
    const mostrar = () => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), 3000);
    };
    window.addEventListener('pointermove', mostrar);
    window.addEventListener('pointerdown', mostrar);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', mostrar);
      window.removeEventListener('pointerdown', mostrar);
    };
  }, [menuAbierto, pausado]);

  if (menuAbierto || pausado) return false;
  return visible;
}
