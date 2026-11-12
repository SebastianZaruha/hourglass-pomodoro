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
  const pieza = (href: string, largo: string, corto: string) => (
    <a href={href} onClick={open(href, largo)}>
      <span className="largo">{largo}</span>
      <span className="corto">{corto}</span>
    </a>
  );
  return (
    <footer className="site-footer">
      {pieza(hrefs.legal, labels.legal, 'Legal')}
      {pieza(hrefs.privacy, labels.privacy, 'Privacidad')}
      {pieza(hrefs.cookies, labels.cookies, 'Cookies')}
      {pieza(hrefs.app, labels.app, 'App')}
      <button type="button" id="configure-cookies" onClick={onCookies}>
        <span className="largo">{labels.settings}</span>
        <span className="corto">Ajustes</span>
      </button>
    </footer>
  );
}
