import { useRef } from 'react';

import { useFrasco, type ModeloFrasco } from './useFrasco';
import './lienzo.css';

export function Lienzo({ oculto, ...modelo }: ModeloFrasco & { readonly oculto: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const nubeRef = useRef<HTMLVideoElement>(null);
  useFrasco(ref, modelo, nubeRef);
  return (
    <>
      <canvas ref={ref} className={oculto ? 'lienzo lienzo-oculto' : 'lienzo'} aria-hidden="true" />
      <video
        ref={nubeRef}
        className={modelo.mostrarNube ? 'nube-dom' : 'nube-dom nube-oculta'}
        muted
        playsInline
        loop
        poster="/nube/nube.webp"
        aria-hidden="true"
      />
    </>
  );
}
