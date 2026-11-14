import type { Language } from '@reloj/core';
import { useEffect, useState } from 'react';

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

const TACTIL = '(hover: none) and (pointer: coarse)';

function useTactil() {
  const [tactil, setTactil] = useState(() => window.matchMedia(TACTIL).matches);
  useEffect(() => {
    const mq = window.matchMedia(TACTIL);
    const alCambiar = () => setTactil(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return tactil;
}

/** La pausa publicada: la palabra y la pista de la web, sin tocar el frasco. */
export function Pausa({ word, lang }: Props) {
  const tactil = useTactil();
  const pista = PISTA[lang][tactil ? 'tactil' : 'raton'];
  return (
    <div className="pause-screen">
      <span className="pause-word">{word}</span>
      <span className="pause-hint">{pista}</span>
    </div>
  );
}
