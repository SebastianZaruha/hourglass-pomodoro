import type { CSSProperties, RefObject } from 'react';

import type { Language } from '@reloj/core';

import { bannerCopy, PAGINAS } from '../copy';
import type { ConsentChoice } from '../cookies';
import type { Caja } from '../layout/cajas';
import { keepAppOnLegalClick } from './LegalOverlay';
import './cookies.css';

interface Props {
  readonly open: boolean;
  readonly lang: Language;
  readonly caja: Caja;
  readonly nodoRef: RefObject<HTMLDivElement | null>;
  readonly onChoose: (choice: ConsentChoice) => void;
  readonly onOpenLegal: (href: string, title: string) => void;
}

function estiloDe(caja: Caja): CSSProperties {
  return { left: caja.x, top: caja.y, width: caja.w, right: 'auto', bottom: 'auto', transform: 'none' };
}

export function CookieBanner({ open, lang, caja, nodoRef, onChoose, onOpenLegal }: Props) {
  if (!open) return null;
  const copy = bannerCopy(lang);
  const hrefs = PAGINAS[lang];
  return (
    <div ref={nodoRef} className="banner vidrio" role="region" aria-label={copy.label} style={estiloDe(caja)}>
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
