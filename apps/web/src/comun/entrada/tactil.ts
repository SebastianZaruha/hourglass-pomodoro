import { useEffect, useState } from 'react';

/** La misma consulta que la pista de la pausa: pantalla táctil, sin hover. */
export const TACTIL = '(hover: none) and (pointer: coarse)';

export function useTactil(): boolean {
  const [tactil, setTactil] = useState(() => window.matchMedia(TACTIL).matches);
  useEffect(() => {
    const mq = window.matchMedia(TACTIL);
    const alCambiar = () => setTactil(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return tactil;
}
