import type { Language } from '@reloj/core';
import { useRef } from 'react';

import { useHojaVidrio } from '../../estilo/vidrio-liquido';
import { bannerCopy, legalHrefs, panelCookiesCopy } from '../../tiempo';
import { keepAppOnLegalClick } from '../legal';
import type { ConsentChoice } from './cookies';

interface Props {
  readonly open: boolean;
  readonly lang: Language;
  readonly onChoose: (choice: ConsentChoice) => void;
  readonly onConfigure: () => void;
  readonly onOpenLegal: (href: string, title: string) => void;
}

export function CookieBanner({ open, lang, onChoose, onConfigure, onOpenLegal }: Props) {
  const hoja = useRef<HTMLDivElement>(null);
  useHojaVidrio(hoja, open);
  if (!open) return null;
  const copy = bannerCopy(lang);
  const hrefs = legalHrefs(lang);
  const policy = panelCookiesCopy(lang).policy;
  return (
    <div ref={hoja} className="banner hoja vidrio vidrio-liquido" role="region" aria-label={copy.label}>
      <p>{copy.body}</p>
      <div className="banner-actions">
        <button type="button" className="choice" onClick={() => onChoose('accepted')}>
          {copy.accept}
        </button>
        <button type="button" className="choice" onClick={() => onChoose('rejected')}>
          {copy.reject}
        </button>
        <button type="button" className="choice" onClick={onConfigure}>
          {copy.more}
        </button>
      </div>
      <a
        className="cookie-policy"
        href={hrefs.cookies}
        onClick={(event) => {
          if (keepAppOnLegalClick(event)) onOpenLegal(hrefs.cookies, policy);
        }}
      >
        {policy}
      </a>
    </div>
  );
}
