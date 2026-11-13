import { useRef } from 'react';

import { useFrasco, type ModeloFrasco } from './useFrasco';
import './lienzo.css';

export function Lienzo({ oculto, ...modelo }: ModeloFrasco & { readonly oculto: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const nubeRef = useRef<HTMLDivElement>(null);
  useFrasco(ref, modelo, nubeRef);
  return (
    <>
      <canvas ref={ref} className={oculto ? 'lienzo lienzo-oculto' : 'lienzo'} aria-hidden="true" />
      <div
        ref={nubeRef}
        className={modelo.mostrarNube ? 'nube-capa' : 'nube-capa nube-oculta'}
        aria-hidden="true"
      >
        <video className="nube-dom" muted playsInline poster="/nube/nube.webp" />
        <video className="nube-dom nube-reserva" muted playsInline />
      </div>
    </>
  );
}
