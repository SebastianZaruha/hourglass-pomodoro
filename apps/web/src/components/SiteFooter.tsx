import type { Language } from '@reloj/core';

import { footerCopy, legalHrefs } from '../copy';

interface Props {
  readonly lang: Language;
  readonly onCookies: () => void;
}

export function SiteFooter({ lang, onCookies }: Props) {
  const labels = footerCopy(lang);
  const hrefs = legalHrefs(lang);
  return (
    <footer className="site-footer">
      <a href={hrefs.legal}>{labels.legal}</a>
      <a href={hrefs.privacy}>{labels.privacy}</a>
      <a href={hrefs.cookies}>{labels.cookies}</a>
      <button type="button" id="configure-cookies" onClick={onCookies}>
        {labels.settings}
      </button>
    </footer>
  );
}
