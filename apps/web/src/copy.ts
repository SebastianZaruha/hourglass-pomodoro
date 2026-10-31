import type { Language, TimerStatus } from '@reloj/core';

import type { AndroidDistribution } from './androidApp';

/** Pistas de ratón (la app móvil habla de gestos táctiles; aquí no). */
export function hintFor(lang: Language, status: TimerStatus, cyclesFinished: boolean): string | null {
  const es = lang === 'es';
  if (status === 'idle') {
    return es ? 'clic para empezar · rueda para el tiempo' : 'click to start · scroll to set the time';
  }
  if (status === 'paused') {
    return es
      ? 'clic para seguir · arrastra el reloj para voltearlo'
      : 'click to resume · drag the hourglass to flip';
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

export interface AndroidPromoCopy {
  readonly title: string;
  readonly pitch: string;
  readonly action: string;
  readonly actionHint: string;
  readonly dismiss: string;
}

/** Aviso y fila del menú de la app Android. El botón depende de dónde se descarga. */
export function androidPromoCopy(lang: Language, distribution: AndroidDistribution): AndroidPromoCopy {
  const es = lang === 'es';
  const action = androidActionLabel(lang, distribution);
  const actionHint = androidActionHint(lang, distribution);
  if (es) {
    return {
      title: 'App Android',
      pitch: 'La arena reacciona al mover la mano y al inclinar el móvil.',
      action,
      actionHint,
      dismiss: 'Cerrar el aviso de la app',
    };
  }
  return {
    title: 'Android app',
    pitch: 'The sand reacts to your hand and to tilting the phone.',
    action,
    actionHint,
    dismiss: 'Dismiss the app notice',
  };
}

function androidActionLabel(lang: Language, distribution: AndroidDistribution): string {
  switch (distribution) {
    case 'play-store':
      return lang === 'es' ? 'Play Store' : 'Google Play';
    case 'github-release':
      return lang === 'es' ? 'Descargar' : 'Download';
    default: {
      const unreachable: never = distribution;
      return unreachable;
    }
  }
}

function androidActionHint(lang: Language, distribution: AndroidDistribution): string {
  switch (distribution) {
    case 'play-store':
      return lang === 'es' ? 'Abrir en Google Play' : 'Open in Google Play';
    case 'github-release':
      return lang === 'es'
        ? 'Descargar el APK desde GitHub Releases'
        : 'Download the APK from GitHub Releases';
    default: {
      const unreachable: never = distribution;
      return unreachable;
    }
  }
}

/** Texto del banner, tal como lo dejó el abogado (banner-cookies-copy.md). */
export function bannerCopy(lang: Language) {
  if (lang === 'es') {
    return {
      body: 'Usamos cookies técnicas necesarias y, solo si aceptas, cookies de analítica de Google Analytics para saber cómo se usa la web. Vercel Web Analytics, también solo si aceptas, mide visitas sin cookies. Puedes cambiar tu elección cuando quieras en «Configurar cookies».',
      accept: 'Aceptar',
      reject: 'Rechazar',
      more: 'Configurar',
      label: 'Cookies',
    };
  }
  return {
    body: 'We use strictly necessary cookies and, only if you accept, Google Analytics cookies to understand how the site is used. Vercel Web Analytics, also only if you accept, measures visits without cookies. You can change your choice at any time in “Cookie settings”.',
    accept: 'Accept',
    reject: 'Reject',
    more: 'Configure',
    label: 'Cookies',
  };
}
