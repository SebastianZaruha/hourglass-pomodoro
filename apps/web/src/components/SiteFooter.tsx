import type { MouseEvent } from 'react';

import { PAGINAS, PIE } from '../copy';
import { keepAppOnLegalClick } from './LegalOverlay';

interface Props {
  readonly onCookies: () => void;
  readonly onOpenLegal: (href: string, title: string) => void;
}

export function SiteFooter({ onCookies, onOpenLegal }: Props) {
  const labels = PIE;
  const hrefs = PAGINAS.es;
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
      <a href={hrefs.app} onClick={open(hrefs.app, labels.app)}>
        {labels.app}
      </a>
      <button type="button" id="configure-cookies" onClick={onCookies}>
        {labels.settings}
      </button>
    </footer>
  );
}
