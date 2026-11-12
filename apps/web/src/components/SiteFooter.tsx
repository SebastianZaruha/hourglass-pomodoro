import type { MouseEvent } from 'react';

import type { Language } from '@reloj/core';

import { footerCopy, PAGINAS } from '../copy';
import { keepAppOnLegalClick } from './LegalOverlay';

interface Props {
  readonly lang: Language;
  readonly visible: boolean;
  readonly onCookies: () => void;
  readonly onOpenLegal: (href: string, title: string) => void;
}

export function SiteFooter({ lang, visible, onCookies, onOpenLegal }: Props) {
  const labels = footerCopy(lang);
  const hrefs = PAGINAS[lang];
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
    <footer className={visible ? 'site-footer is-on' : 'site-footer'}>
      {pieza(hrefs.legal, labels.legal, labels.legalCorto)}
      {pieza(hrefs.privacy, labels.privacy, labels.privacyCorto)}
      {pieza(hrefs.cookies, labels.cookies, labels.cookiesCorto)}
      {pieza(hrefs.app, labels.app, labels.appCorto)}
      <button type="button" id="configure-cookies" onClick={onCookies}>
        <span className="largo">{labels.settings}</span>
        <span className="corto">{labels.settingsCorto}</span>
      </button>
    </footer>
  );
}
