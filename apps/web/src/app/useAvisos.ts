import { useEffect, useState } from 'react';

import {
  androidPromoOpen,
  readAndroidPromoDismissed,
  writeAndroidPromoDismissed,
} from '../comun/paneles/android';
import {
  disableGoogleAnalytics,
  eleccionDe,
  enableGoogleAnalytics,
  gaMeasurementId,
  preferenciasDe,
  readConsent,
  resumeVercelWebAnalytics,
  stopVercelWebAnalytics,
  writeConsent,
  type AnalyticsPrefs,
  type ConsentChoice,
  type ConsentRecord,
} from '../comun/paneles/cookies';

const APAGADO: AnalyticsPrefs = { google: false, vercel: false };

/**
 * Cookies, aviso de Android y panel legal: cuál está abierto.
 * La misma prioridad que la publicada.
 */
export function useAvisos(abierto: {
  readonly menu: boolean;
  readonly introLista: boolean;
  readonly sesionTerminada: boolean;
  readonly cubierto?: boolean;
}) {
  const [promoDismissed, setPromoDismissed] = useState(() => readAndroidPromoDismissed());
  const [legal, setLegal] = useState<{ href: string; title: string } | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(() => readConsent());
  const [panelOpen, setPanelOpen] = useState(() => pideConfigurarCookies());
  const [bannerOpen, setBannerOpen] = useState(() => readConsent() === null && !pideConfigurarCookies());

  useEffect(() => {
    if (!pideConfigurarCookies()) return;
    setPanelOpen(true);
    const params = new URLSearchParams(location.search);
    params.delete('configure-cookies');
    const search = params.toString();
    const hash = location.hash === '#configure-cookies' ? '' : location.hash;
    history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}${hash}`);
  }, []);

  useEffect(() => {
    const prefs = preferenciasDe(consent);
    if (!prefs) return;
    aplicarAnalitica(prefs);
  }, [consent]);

  const guardarCookies = (prefs: AnalyticsPrefs) => {
    const choice = eleccionDe(prefs);
    writeConsent(choice, localStorage, Date.now(), prefs);
    aplicarAnalitica(prefs);
    setConsent(readConsent());
    setPanelOpen(false);
    setBannerOpen(false);
  };

  const chooseCookies = (choice: ConsentChoice) => {
    if (choice === 'custom') return;
    guardarCookies(choice === 'accepted' ? { google: true, vercel: true } : APAGADO);
  };

  const cerrarPanel = () => {
    setPanelOpen(false);
    if (readConsent() === null) setBannerOpen(true);
  };

  const dismissAndroidPromo = () => {
    writeAndroidPromoDismissed();
    setPromoDismissed(true);
  };

  const cookiesAbiertas = bannerOpen || panelOpen;
  const showAndroidPromo = androidPromoOpen({
    settled: abierto.introLista,
    sesionTerminada: abierto.sesionTerminada,
    dismissed: promoDismissed,
    bannerOpen: cookiesAbiertas,
    menuOpen: abierto.menu,
    legalOpen: legal !== null,
    cubierto: abierto.cubierto,
  });
  const prefs = preferenciasDe(consent);

  return {
    legal,
    setLegal,
    bannerOpen,
    panelOpen,
    cookiesAbiertas,
    abrirPanel: () => setPanelOpen(true),
    cerrarPanel,
    inicialCookies: prefs ?? APAGADO,
    vercel: prefs?.vercel === true,
    consentChoice: consent?.choice ?? null,
    chooseCookies,
    guardarCookies,
    dismissAndroidPromo,
    showAndroidPromo,
  };
}

function pideConfigurarCookies(): boolean {
  if (typeof location === 'undefined') return false;
  return (
    new URLSearchParams(location.search).get('configure-cookies') === '1' ||
    location.hash === '#configure-cookies'
  );
}

function aplicarAnalitica(prefs: AnalyticsPrefs): void {
  const id = gaMeasurementId();
  if (prefs.google) enableGoogleAnalytics(id);
  else disableGoogleAnalytics(id);
  if (prefs.vercel) resumeVercelWebAnalytics();
  else stopVercelWebAnalytics();
}
