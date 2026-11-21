import type { Language } from '@reloj/core';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useHojaVidrio } from '../estilo/vidrio-liquido';
import { TarroDia } from './TarroDia';
import type { ArenaDia } from './dia';

interface Props {
  readonly abierta: boolean;
  readonly arena: ArenaDia;
  readonly lang: Language;
  readonly alCerrar: () => void;
}

/** El detalle de la racha, con el mismo vidrio que el resto de hojas. */
export function HojaDia({ abierta, arena, lang, alCerrar }: Props) {
  const hoja = useRef<HTMLDivElement>(null);
  useHojaVidrio(hoja, abierta);
  useEffect(() => {
    if (!abierta) return;
    const alTecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [abierta, alCerrar]);
  if (!abierta) return null;
  const es = lang === 'es';
  const titulo = es ? 'Racha de hoy' : "Today's streak";
  return createPortal(
    <div className="dia-velo" onClick={alCerrar}>
      <div
        ref={hoja}
        className="dia-hoja hoja vidrio vidrio-liquido"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dia-cabeza">
          <h2>{titulo}</h2>
          <button type="button" className="control redondo" aria-label={es ? 'Cerrar' : 'Close'} onClick={alCerrar}>
            ×
          </button>
        </div>
        <TarroDia arena={arena} lang={lang} />
      </div>
    </div>,
    document.body,
  );
}
