import type { MouseEvent, RefObject } from 'react';

import type { Language } from '@reloj/core';

import { footerCopy, PAGINAS } from '../copy';
import { keepAppOnLegalClick } from './LegalOverlay';
import './pie.css';

interface Props {
  readonly lang: Language;
  readonly visible: boolean;
  readonly oculto: boolean;
  readonly onCookies: () => void;
  readonly onOpenLegal: (href: string, title: string) => void;
  readonly pieRef: RefObject<HTMLElement | null>;
  readonly top: number;
}

export function SiteFooter({ lang, visible, oculto, onCookies, onOpenLegal, pieRef, top }: Props) {
  const labels = footerCopy(lang);
  const hrefs = PAGINAS[lang];
  const open = (href: string, title: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (keepAppOnLegalClick(event)) onOpenLegal(href, title);
  };
  const pieza = (href: string, largo: string, corto: string) => (
    <a className="pie-enlace" href={href} onClick={open(href, largo)}>
      <span className="largo">{largo}</span>
      <span className="corto">{corto}</span>
    </a>
  );
  const clases = ['site-footer', visible ? 'is-on' : '', oculto ? 'pie-oculto' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <footer ref={pieRef} className={clases} style={{ top, bottom: 'auto' }}>
      {pieza(hrefs.legal, labels.legal, labels.legalCorto)}
      {pieza(hrefs.privacy, labels.privacy, labels.privacyCorto)}
      {pieza(hrefs.cookies, labels.cookies, labels.cookiesCorto)}
      {pieza(hrefs.app, labels.app, labels.appCorto)}
      <button type="button" id="configure-cookies" className="pie-enlace" onClick={onCookies}>
        <span className="largo">{labels.settings}</span>
        <span className="corto">{labels.settingsCorto}</span>
      </button>
    </footer>
  );
}
