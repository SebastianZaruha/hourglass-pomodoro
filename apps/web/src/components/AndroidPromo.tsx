import type { Language } from '@reloj/core';

import { ANDROID_APP } from '../androidApp';
import { androidPromoCopy } from '../copy';

interface Props {
  readonly lang: Language;
  readonly onDismiss: () => void;
}

/** Tira discreta, debajo del reloj. No es el banner de cookies. */
export function AndroidPromo({ lang, onDismiss }: Props) {
  const copy = androidPromoCopy(lang, ANDROID_APP.distribution);
  return (
    <div className="app-promo" onClick={(event) => event.stopPropagation()}>
      <p className="app-promo-text">
        <span className="app-promo-title">{copy.title}</span>
        <span className="app-promo-pitch">{copy.pitch}</span>
      </p>
      <a
        className="app-promo-action"
        href={ANDROID_APP.url}
        target="_blank"
        rel="noopener noreferrer"
        title={copy.actionHint}
        aria-label={`${copy.action}. ${copy.title}. ${copy.pitch}`}
      >
        {copy.action}
      </a>
      <button type="button" className="app-promo-dismiss" aria-label={copy.dismiss} onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
