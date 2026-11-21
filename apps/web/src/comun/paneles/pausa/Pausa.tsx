import type { Language } from '@reloj/core';
import { useEffect, useRef, useState } from 'react';

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

const TACTIL = '(hover: none) and (pointer: coarse)';
// La tinta se elige mirando solo la zona de la palabra y la pista, no toda la pantalla.
const PAUSA = { bisel: 0, muestra: '.pause-word, .pause-hint' } as const;

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
  const hoja = useRef<HTMLDivElement>(null);
  // Pantalla entera: sin canto brillante en los bordes del navegador; escarcha y grano sí.
  useHojaVidrio(hoja, true, PAUSA);
  const tactil = useTactil();
  const pista = PISTA[lang][tactil ? 'tactil' : 'raton'];
  return (
    <div ref={hoja} className="pause-screen hoja vidrio vidrio-liquido">
      <span className="pause-word">{word}</span>
      <span className="pause-hint">{pista}</span>
    </div>
  );
}
