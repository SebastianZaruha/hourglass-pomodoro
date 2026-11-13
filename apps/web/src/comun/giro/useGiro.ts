import { useRef } from 'react';

import { crearGiro, type MaquinaGiro } from './giro';

/** La misma máquina durante toda la vida del reloj. No provoca renders. */
export function useGiro(): MaquinaGiro {
  const ref = useRef<MaquinaGiro | null>(null);
  if (!ref.current) ref.current = crearGiro();
  return ref.current;
}
