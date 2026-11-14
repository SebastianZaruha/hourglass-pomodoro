import { useEffect, useState } from 'react';

import {
  androidPromoOpen,
  readAndroidPromoDismissed,
  writeAndroidPromoDismissed,
} from '../comun/paneles/android';
import {
  disableGoogleAnalytics,
  enableGoogleAnalytics,
  gaMeasurementId,
  readConsent,
  stopVercelWebAnalytics,
  writeConsent,
  type ConsentChoice,
} from '../comun/paneles/cookies';

/**
 * Cookies, aviso de Android y panel legal: cuál está abierto.
 * La misma prioridad que la publicada.
 */
export function useAvisos(abierto: { readonly menu: boolean; readonly introLista: boolean }) {
  const [promoDismissed, setPromoDismissed] = useState(() => readAndroidPromoDismissed());
  const [legal, setLegal] = useState<{ href: string; title: string } | null>(null);
  const [consentChoice, setConsentChoice] = useState<ConsentChoice | null>(
    () => readConsent()?.choice ?? null,
  );
  const [bannerOpen, setBannerOpen] = useState(() => {
    if (readConsent() === null) return true;
    if (typeof location === 'undefined') return false;
    return (
      new URLSearchParams(location.search).get('configure-cookies') === '1' ||
      location.hash === '#configure-cookies'
    );
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('configure-cookies') === '1' || location.hash === '#configure-cookies') {
      setBannerOpen(true);
      params.delete('configure-cookies');
      const search = params.toString();
      const hash = location.hash === '#configure-cookies' ? '' : location.hash;
      history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}${hash}`);
    }
  }, []);

  useEffect(() => {
    const id = gaMeasurementId();
    if (consentChoice === 'accepted') enableGoogleAnalytics(id);
    else if (consentChoice === 'rejected') {
      disableGoogleAnalytics(id);
      stopVercelWebAnalytics();
    }
  }, [consentChoice]);

  const chooseCookies = (choice: ConsentChoice) => {
    writeConsent(choice);
    setConsentChoice(choice);
    setBannerOpen(false);
  };

  const dismissAndroidPromo = () => {
    writeAndroidPromoDismissed();
    setPromoDismissed(true);
  };

  const showAndroidPromo = androidPromoOpen({
    settled: abierto.introLista,
    dismissed: promoDismissed,
    bannerOpen,
    menuOpen: abierto.menu,
    legalOpen: legal !== null,
  });

  return {
    legal,
    setLegal,
    bannerOpen,
    setBannerOpen,
    consentChoice,
    chooseCookies,
    dismissAndroidPromo,
    showAndroidPromo,
  };
}
