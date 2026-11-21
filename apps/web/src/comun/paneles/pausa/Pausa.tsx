import type { Language } from '@reloj/core';
import { useRef } from 'react';

import { useTactil } from '../../entrada/tactil';
import { useHojaVidrio } from '../../estilo/vidrio-liquido';

interface Props {
  readonly word: string;
  readonly lang: Language;
}

const PISTA = {
  es: {
    raton: 'clic para seguir',
    tactil: 'toca para seguir',
  },
  en: {
    raton: 'click to resume',
    tactil: 'tap to resume',
  },
} as const;

/** La pausa publicada: la palabra y la pista de la web, sin tocar el frasco. */
export function Pausa({ word, lang }: Props) {
  const hoja = useRef<HTMLDivElement>(null);
  useHojaVidrio(hoja);
  const tactil = useTactil();
  const pista = PISTA[lang][tactil ? 'tactil' : 'raton'];
  return (
    <div ref={hoja} className="pause-screen hoja vidrio vidrio-liquido">
      <span className="pause-word">{word}</span>
      <span className="pause-hint">{pista}</span>
    </div>
  );
}
