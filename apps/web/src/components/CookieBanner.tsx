import { bannerCopy, PAGINAS } from '../copy';
import type { ConsentChoice } from '../cookies';
import { keepAppOnLegalClick } from './LegalOverlay';

interface Props {
  readonly open: boolean;
  readonly onChoose: (choice: ConsentChoice) => void;
  readonly onOpenLegal: (href: string, title: string) => void;
}

export function CookieBanner({ open, onChoose, onOpenLegal }: Props) {
  if (!open) return null;
  const copy = bannerCopy();
  const hrefs = PAGINAS.es;
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
        <a
          className="choice"
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
