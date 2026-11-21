import type { Language } from '@reloj/core';
import { useRef } from 'react';

import { useHojaVidrio } from '../../estilo/vidrio-liquido';
import './aviso.css';

interface Props {
  readonly abierta: boolean;
  readonly lang: Language;
  readonly alAceptar: () => void;
  readonly alRechazar: () => void;
}

const TEXTO = {
  es: {
    pregunta: '¿Te aviso la próxima vez aunque estés en otra pestaña?',
    si: 'Sí, avísame',
    no: 'Ahora no',
  },
  en: {
    pregunta: 'Shall I let you know next time, even if you are in another tab?',
    si: 'Yes, notify me',
    no: 'Not now',
  },
} as const;

/** Hoja breve al terminar la primera sesión. El permiso del navegador solo se pide si aceptan. */
export function AvisoSesion({ abierta, lang, alAceptar, alRechazar }: Props) {
  const hoja = useRef<HTMLDivElement>(null);
  useHojaVidrio(hoja, abierta);
  if (!abierta) return null;
  const t = TEXTO[lang];
  return (
    <div ref={hoja} className="aviso-sesion hoja vidrio vidrio-liquido" role="dialog" aria-label={t.pregunta}>
      <p>{t.pregunta}</p>
      <div className="aviso-sesion-acciones">
        <button type="button" className="choice" onClick={alAceptar}>
          {t.si}
        </button>
        <button type="button" className="choice" onClick={alRechazar}>
          {t.no}
        </button>
      </div>
    </div>
  );
}
