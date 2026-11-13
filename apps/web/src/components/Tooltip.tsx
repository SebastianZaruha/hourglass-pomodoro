import type { ReactNode } from 'react';

import './Tooltip.css';

/** Pista propia. No es un ::after global: así no pisa el resto de los botones. */
export function Tooltip({ texto, children }: { readonly texto: string; readonly children: ReactNode }) {
  return (
    <span className="ayuda">
      {children}
      <span className="ayuda-texto" role="tooltip">
        {texto}
      </span>
    </span>
  );
}
