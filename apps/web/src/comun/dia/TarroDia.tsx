import type { Language } from '@reloj/core';

import { compartirHoy, textoArenaDia, type ArenaDia } from './dia';
import './tarro.css';

interface Props {
  readonly arena: ArenaDia;
  readonly lang: Language;
}

/** El tarro del día, dentro del menú. Sin gráficas. */
export function TarroDia({ arena, lang }: Props) {
  const es = lang === 'es';
  const lleno = Math.max(0, Math.min(1, arena.hoy / 8));
  return (
    <div className="tarro-dia">
      <div className="tarro-silueta" aria-hidden="true">
        <span className="tarro-arena" style={{ height: `${Math.round(lleno * 100)}%` }} />
      </div>
      <p>{textoArenaDia(arena, es)}</p>
      <button type="button" className="control" onClick={() => void compartirHoy(arena.hoy, es)}>
        {es ? 'Compartir el día' : 'Share today'}
      </button>
    </div>
  );
}
