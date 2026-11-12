import { useRef } from 'react';

import { useFrasco, type ModeloFrasco } from './useFrasco';
import './lienzo.css';

export function Lienzo(modelo: ModeloFrasco) {
  const ref = useRef<HTMLCanvasElement>(null);
  useFrasco(ref, modelo);
  return <canvas ref={ref} className="lienzo" aria-hidden="true" />;
}
