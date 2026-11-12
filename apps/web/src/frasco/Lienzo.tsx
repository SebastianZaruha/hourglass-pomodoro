import { useRef } from 'react';

import { useFrasco, type ModeloFrasco } from './useFrasco';

export function Lienzo(modelo: ModeloFrasco) {
  const ref = useRef<HTMLCanvasElement>(null);
  useFrasco(ref, modelo);
  return <canvas ref={ref} className="lienzo" aria-hidden="true" />;
}
