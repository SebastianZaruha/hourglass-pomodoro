import { useRef } from 'react';

import { useFrasco, type ModeloFrasco } from './useFrasco';
import './lienzo.css';

export function Lienzo({ oculto, ...modelo }: ModeloFrasco & { readonly oculto: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useFrasco(ref, modelo);
  return <canvas ref={ref} className={oculto ? 'lienzo lienzo-oculto' : 'lienzo'} aria-hidden="true" />;
}
