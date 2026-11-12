import type { RefObject } from 'react';

import type { Language } from '@reloj/core';

import { bannerCopy, PAGINAS } from '../copy';
import type { ConsentChoice } from '../cookies';
import { keepAppOnLegalClick } from './LegalOverlay';
import './cookies.css';

interface Props {
  readonly open: boolean;
  readonly lang: Language;
  readonly nodoRef: RefObject<HTMLDivElement | null>;
  readonly onChoose: (choice: ConsentChoice) => void;
  readonly onOpenLegal: (href: string, title: string) => void;
}

/** Abajo, centrado. La posición la pone el CSS. */
export function CookieBanner({ open, lang, nodoRef, onChoose, onOpenLegal }: Props) {
  if (!open) return null;
  const copy = bannerCopy(lang);
  const hrefs = PAGINAS[lang];
  return (
    <div ref={nodoRef} className="banner vidrio" role="region" aria-label={copy.label}>
      <p className="banner-texto">{copy.body}</p>
      <div className="banner-actions">
        <button type="button" className="control" onClick={() => onChoose('accepted')}>
          {copy.accept}
        </button>
        <button type="button" className="control" onClick={() => onChoose('rejected')}>
          {copy.reject}
        </button>
        <a
          className="control"
          href={hrefs.cookies}
          onClick={(event) => {
            if (keepAppOnLegalClick(event)) onOpenLegal(hrefs.cookies, copy.more);
          }}
        >
          {copy.more}
        </a>
      </div>
    </div>
  );
}
