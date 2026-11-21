import type { Language } from '@reloj/core';
import { useEffect, useRef, useState } from 'react';

import { useHojaVidrio } from '../../estilo/vidrio-liquido';
import { legalHrefs, panelCookiesCopy } from '../../tiempo';
import { keepAppOnLegalClick } from '../legal';
import type { AnalyticsPrefs } from './cookies';

interface Props {
  readonly open: boolean;
  readonly lang: Language;
  readonly inicial: AnalyticsPrefs;
  readonly onGuardar: (prefs: AnalyticsPrefs) => void;
  readonly onCerrar: () => void;
  readonly onOpenLegal: (href: string, title: string) => void;
}

const APAGADO: AnalyticsPrefs = { google: false, vercel: false };

/** Preferencias. Los dos interruptores salen apagados si aún no hay elección. */
export function PanelCookies({ open, lang, inicial, onGuardar, onCerrar, onOpenLegal }: Props) {
  const hoja = useRef<HTMLDivElement>(null);
  useHojaVidrio(hoja, open);
  const [google, setGoogle] = useState(inicial.google);
  const [vercel, setVercel] = useState(inicial.vercel);
  useEffect(() => {
    if (!open) return;
    setGoogle(inicial.google);
    setVercel(inicial.vercel);
  }, [open, inicial.google, inicial.vercel]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCerrar]);
  if (!open) return null;
  const copy = panelCookiesCopy(lang);
  const hrefs = legalHrefs(lang);
  const guardar = (prefs: AnalyticsPrefs) => onGuardar(prefs);
  return (
    <>
      <button type="button" className="cookie-dismiss" aria-label={copy.close} onClick={onCerrar} />
      <div
        ref={hoja}
        className="cookie-panel banner hoja vidrio vidrio-liquido"
        role="dialog"
        aria-modal="true"
        aria-label={copy.label}
      >
        <a
          className="cookie-policy"
          href={hrefs.cookies}
          onClick={(event) => {
            if (keepAppOnLegalClick(event)) onOpenLegal(hrefs.cookies, copy.policy);
          }}
        >
          {copy.policy}
        </a>
        <div className="cookie-switches">
          <Interruptor label={copy.google} checked={google} onToggle={() => setGoogle((value) => !value)} />
          <Interruptor label={copy.vercel} checked={vercel} onToggle={() => setVercel((value) => !value)} />
        </div>
        <div className="banner-actions">
          <button type="button" className="choice" onClick={() => guardar({ google, vercel })}>
            {copy.save}
          </button>
          <button type="button" className="choice" onClick={() => guardar({ google: true, vercel: true })}>
            {copy.acceptAll}
          </button>
          <button type="button" className="choice" onClick={() => guardar(APAGADO)}>
            {copy.rejectAll}
          </button>
        </div>
      </div>
    </>
  );
}

function Interruptor({
  label,
  checked,
  onToggle,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button type="button" className="cookie-switch" role="switch" aria-checked={checked} onClick={onToggle}>
      <span>{label}</span>
      <span className="cookie-track" aria-hidden="true">
        <span className="cookie-knob" />
      </span>
    </button>
  );
}
