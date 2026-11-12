import type { CSSProperties, RefObject } from 'react';

import type { Language } from '@reloj/core';

import { ANDROID_APP } from '../androidApp';
import { androidPromoCopy } from '../copy';
import type { Caja } from '../layout/cajas';
import { Tooltip } from './Tooltip';
import './promo.css';

interface Props {
  readonly lang: Language;
  readonly pausado: boolean;
  readonly caja: Caja;
  readonly nodoRef: RefObject<HTMLDivElement | null>;
  readonly onDismiss: () => void;
}

/** Aviso en la caja medida. No es el banner de cookies. */
function estiloDe(caja: Caja): CSSProperties {
  return { left: caja.x, top: caja.y, width: caja.w, right: 'auto', bottom: 'auto' };
}

export function AndroidPromo({ lang, pausado, caja, nodoRef, onDismiss }: Props) {
  const copy = androidPromoCopy(ANDROID_APP.distribution, lang);
  return (
    <div
      ref={nodoRef}
      className={pausado ? 'app-promo vidrio promo-pausa' : 'app-promo vidrio'}
      style={estiloDe(caja)}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="app-promo-text">
        <span className="app-promo-title">{copy.title}</span>
        <span className="app-promo-pitch">{copy.pitch}</span>
        <span className="app-promo-install">{copy.installNote}</span>
      </p>
      <a
        className="control app-promo-action"
        href={ANDROID_APP.url}
        target="_blank"
        rel="noopener noreferrer"
        title={copy.actionHint}
        aria-label={`${copy.action}. ${copy.title}. ${copy.pitch}`}
      >
        {copy.action}
      </a>
      <Tooltip texto={copy.dismiss}>
        <button type="button" className="control promo-cerrar" aria-label={copy.dismiss} onClick={onDismiss}>
          ×
        </button>
      </Tooltip>
    </div>
  );
}
