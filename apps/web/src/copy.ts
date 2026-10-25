import type { Language, TimerStatus } from '@reloj/core';

/** Pistas de ratón (la app móvil habla de gestos táctiles; aquí no). */
export function hintFor(lang: Language, status: TimerStatus, cyclesFinished: boolean): string | null {
  const es = lang === 'es';
  if (status === 'idle') {
    return es ? 'clic para empezar · rueda para el tiempo' : 'click to start · scroll to set the time';
  }
  if (status === 'paused') {
    return es ? 'clic para seguir · doble clic para reiniciar' : 'click to resume · double-click to restart';
  }
  if (status === 'finished') {
    return cyclesFinished
      ? es
        ? 'ciclos completados · clic para empezar'
        : 'cycles complete · click to start'
      : es
        ? 'clic para volver a empezar'
        : 'click to start again';
  }
  return null;
}

export function footerCopy(lang: Language) {
  if (lang === 'es') {
    return {
      legal: 'Aviso legal',
      privacy: 'Privacidad',
      cookies: 'Cookies',
      settings: 'Configurar cookies',
    };
  }
  return {
    legal: 'Legal notice',
    privacy: 'Privacy',
    cookies: 'Cookies',
    settings: 'Cookie settings',
  };
}

export function legalHrefs(lang: Language) {
  if (lang === 'es') {
    return {
      legal: '/aviso-legal.html',
      privacy: '/privacidad.html',
      cookies: '/cookies.html',
    };
  }
  return {
    legal: '/legal-notice.html',
    privacy: '/privacy.html',
    cookies: '/cookies-en.html',
  };
}

/** Texto del banner, tal como lo dejó el abogado (banner-cookies-copy.md). */
export function bannerCopy(lang: Language) {
  if (lang === 'es') {
    return {
      body: 'Usamos cookies técnicas necesarias y, solo si aceptas, cookies de analítica de Google Analytics para saber cómo se usa la web. Vercel Web Analytics mide visitas sin cookies. Puedes cambiar tu elección cuando quieras en «Configurar cookies».',
      accept: 'Aceptar',
      reject: 'Rechazar',
      more: 'Más información',
      label: 'Cookies',
    };
  }
  return {
    body: 'We use strictly necessary cookies and, only if you accept, Google Analytics cookies to understand how the site is used. Vercel Web Analytics measures visits without cookies. You can change your choice at any time in “Cookie settings”.',
    accept: 'Accept',
    reject: 'Reject',
    more: 'More info',
    label: 'Cookies',
  };
}
