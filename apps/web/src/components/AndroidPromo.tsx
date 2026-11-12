import type { Language } from '@reloj/core';

import { ANDROID_APP } from '../androidApp';
import { androidPromoCopy } from '../copy';
import { Tooltip } from './Tooltip';
import './promo.css';

interface Props {
  readonly lang: Language;
  readonly pausado: boolean;
  readonly onDismiss: () => void;
}

/** Tira discreta, debajo del reloj. No es el banner de cookies. */
export function AndroidPromo({ lang, pausado, onDismiss }: Props) {
  const copy = androidPromoCopy(ANDROID_APP.distribution, lang);
  return (
    <div
      className={pausado ? 'app-promo vidrio promo-pausa' : 'app-promo vidrio'}
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
