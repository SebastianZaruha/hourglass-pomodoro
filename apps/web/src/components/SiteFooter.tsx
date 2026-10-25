import type { Language } from '@reloj/core';
import type { MouseEvent } from 'react';

import { footerCopy, legalHrefs } from '../copy';
import { keepAppOnLegalClick } from './LegalOverlay';

interface Props {
  readonly lang: Language;
  readonly onCookies: () => void;
  readonly onOpenLegal: (href: string, title: string) => void;
}

export function SiteFooter({ lang, onCookies, onOpenLegal }: Props) {
  const labels = footerCopy(lang);
  const hrefs = legalHrefs(lang);
  const open = (href: string, title: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (keepAppOnLegalClick(event)) onOpenLegal(href, title);
  };
  return (
    <footer className="site-footer">
      <a href={hrefs.legal} onClick={open(hrefs.legal, labels.legal)}>
        {labels.legal}
      </a>
      <a href={hrefs.privacy} onClick={open(hrefs.privacy, labels.privacy)}>
        {labels.privacy}
      </a>
      <a href={hrefs.cookies} onClick={open(hrefs.cookies, labels.cookies)}>
        {labels.cookies}
      </a>
      <button type="button" id="configure-cookies" onClick={onCookies}>
        {labels.settings}
      </button>
    </footer>
  );
}
