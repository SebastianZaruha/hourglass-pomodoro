import type { Language } from '@reloj/core';

import { bannerCopy, legalHrefs } from '../copy';
import type { ConsentChoice } from '../cookies';

interface Props {
  readonly open: boolean;
  readonly lang: Language;
  readonly onChoose: (choice: ConsentChoice) => void;
}

export function CookieBanner({ open, lang, onChoose }: Props) {
  if (!open) return null;
  const copy = bannerCopy(lang);
  const hrefs = legalHrefs(lang);
  return (
    <div className="banner" role="region" aria-label={copy.label}>
      <p>{copy.body}</p>
      <div className="banner-actions">
        <button type="button" className="choice" onClick={() => onChoose('accepted')}>
          {copy.accept}
        </button>
        <button type="button" className="choice" onClick={() => onChoose('rejected')}>
          {copy.reject}
        </button>
        <a className="choice" href={hrefs.cookies}>
          {copy.more}
        </a>
      </div>
    </div>
  );
}
