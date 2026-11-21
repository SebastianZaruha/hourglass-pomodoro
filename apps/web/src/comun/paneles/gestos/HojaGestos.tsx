import type { Language } from '@reloj/core';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useTactil } from '../../entrada/tactil';
import { useHojaVidrio } from '../../estilo/vidrio-liquido';
import './gestos.css';

interface Props {
  readonly abierta: boolean;
  readonly lang: Language;
  readonly alCerrar: () => void;
}

interface Fila {
  readonly titulo: string;
  readonly detalle: string;
}

function filas(lang: Language, tactil: boolean): readonly Fila[] {
  const es = lang === 'es';
  if (tactil) {
    return es
      ? [
          { titulo: 'Toca', detalle: 'Empieza o pausa. En pausa, solo un toque sigue.' },
          { titulo: 'Desliza', detalle: 'Arriba o abajo, con un dedo, para elegir el tiempo.' },
          { titulo: 'Arrastra', detalle: 'Inclina el reloj. Soltar lo devuelve; no empieza la sesión.' },
          { titulo: 'Dos toques', detalle: 'Da la vuelta y empieza de cero, con la arena dentro.' },
        ]
      : [
          { titulo: 'Tap', detalle: 'Starts or pauses. While paused, only a tap resumes.' },
          { titulo: 'Swipe', detalle: 'Up or down, with one finger, to set the time.' },
          { titulo: 'Drag', detalle: 'Tilts the hourglass. Releasing returns it; it does not start.' },
          { titulo: 'Double-tap', detalle: 'Flips it and starts over, with the sand inside.' },
        ];
  }
  return es
    ? [
        { titulo: 'Clic', detalle: 'Empieza o pausa. En pausa, solo un clic sigue.' },
        { titulo: 'Rueda', detalle: 'Ajusta el tiempo. No hace otra cosa.' },
        { titulo: 'Arrastra', detalle: 'Inclina el reloj. Soltar lo devuelve; no empieza la sesión.' },
        { titulo: 'Doble clic', detalle: 'Da la vuelta y empieza de cero, con la arena dentro.' },
      ]
    : [
        { titulo: 'Click', detalle: 'Starts or pauses. While paused, only a click resumes.' },
        { titulo: 'Scroll', detalle: 'Sets the time. It does nothing else.' },
        { titulo: 'Drag', detalle: 'Tilts the hourglass. Releasing returns it; it does not start.' },
        { titulo: 'Double-click', detalle: 'Flips it and starts over, with the sand inside.' },
      ];
}

/** La hoja de gestos de la web, con el mismo vidrio que el menú. */
export function HojaGestos({ abierta, lang, alCerrar }: Props) {
  const hoja = useRef<HTMLDivElement>(null);
  const tactil = useTactil();
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
  const titulo = es ? 'Gestos' : 'Gestures';
  return createPortal(
    <div className="gestos-velo" onClick={alCerrar}>
      <div
        ref={hoja}
        className="gestos-hoja hoja vidrio vidrio-liquido"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="gestos-cabeza">
          <h2>{titulo}</h2>
          <button type="button" className="control redondo" aria-label={es ? 'Cerrar' : 'Close'} onClick={alCerrar}>
            ×
          </button>
        </div>
        <ul>
          {filas(lang, tactil).map((fila) => (
            <li key={fila.titulo}>
              <strong>{fila.titulo}</strong>
              <span>{fila.detalle}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
