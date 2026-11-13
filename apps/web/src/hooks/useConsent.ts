import { useEffect, useState } from 'react';

import { disableGoogleAnalytics, enableGoogleAnalytics, gaMeasurementId } from '../analytics';
import { readConsent, writeConsent, type ConsentChoice } from '../cookies';
import { stopVercelWebAnalytics } from '../vercelAnalytics';

/** Banner de cookies y el alta de la analítica. Vive aparte de la escena. */
export function useConsent() {
  const [choice, setChoice] = useState<ConsentChoice | null>(() => readConsent()?.choice ?? null);
  const [bannerOpen, setBannerOpen] = useState(() => {
    if (readConsent() === null) return true;
    const params = new URLSearchParams(location.search);
    return params.get('configure-cookies') === '1' || location.hash === '#configure-cookies';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('configure-cookies') !== '1' && location.hash !== '#configure-cookies') return;
    setBannerOpen(true);
    params.delete('configure-cookies');
    const search = params.toString();
    const hash = location.hash === '#configure-cookies' ? '' : location.hash;
    history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}${hash}`);
  }, []);

  useEffect(() => {
    const id = gaMeasurementId();
    if (choice === 'accepted') enableGoogleAnalytics(id);
    else if (choice === 'rejected') {
      disableGoogleAnalytics(id);
      stopVercelWebAnalytics();
    }
  }, [choice]);

  const choose = (next: ConsentChoice) => {
    writeConsent(next);
    setChoice(next);
    setBannerOpen(false);
  };

  return { choice, bannerOpen, setBannerOpen, choose };
}
