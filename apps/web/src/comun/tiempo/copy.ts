import type { Language, TimerStatus } from '@reloj/core';

import type { AndroidDistribution } from '../paneles/android';

/** Pistas. `tactil` usa la misma detección que la pausa. */
export function hintFor(
  lang: Language,
  status: TimerStatus,
  cyclesFinished: boolean,
  tactil = false,
): string | null {
  const es = lang === 'es';
  if (status === 'idle') {
    if (tactil) {
      return es
        ? 'toca para empezar · desliza arriba o abajo para ajustar el tiempo'
        : 'tap to start · swipe up or down to set the time';
    }
    return es ? 'clic para empezar · rueda para ajustar el tiempo' : 'click to start · scroll to set the time';
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
      legal: 'Legal y privacidad',
      privacy: 'Privacidad',
      cookies: 'Cookies',
      app: 'App móvil',
      settings: 'Configurar cookies',
    };
  }
  return {
    legal: 'Legal and privacy',
    privacy: 'Privacy',
    cookies: 'Cookies',
    app: 'Mobile app',
    settings: 'Cookie settings',
  };
}

export function legalHrefs(lang: Language) {
  if (lang === 'es') {
    return {
      legal: '/legal#aviso-legal',
      privacy: '/legal#privacidad',
      cookies: '/legal#cookies',
      app: '/app-movil.html',
    };
  }
  return {
    legal: '/legal-en#aviso-legal',
    privacy: '/legal-en#privacidad',
    cookies: '/legal-en#cookies',
    app: '/mobile-app.html',
  };
}

export interface AndroidPromoCopy {
  readonly title: string;
  readonly pitch: string;
  /** Aviso breve sobre Play Protect al instalar fuera de Google Play. */
  readonly installNote: string;
  readonly action: string;
  readonly actionHint: string;
  readonly dismiss: string;
}

/** Misma nota que en el aviso y en las páginas estáticas de la app móvil. */
export function androidInstallNote(lang: Language): string {
  if (lang === 'es') {
    return (
      'Fuera de Google Play, Android puede avisarte (Play Protect o fuentes desconocidas). ' +
      'Es normal al instalar un APK directo del desarrollador.'
    );
  }
  return (
    'Outside Google Play, Android may warn you (Play Protect or unknown sources). ' +
    'That’s normal for a direct APK from the developer.'
  );
}

/** Aviso discreto de la app Android. El botón depende de dónde se descarga. */
export function androidPromoCopy(lang: Language, distribution: AndroidDistribution): AndroidPromoCopy {
  const es = lang === 'es';
  const action = androidActionLabel(lang, distribution);
  const actionHint = androidActionHint(lang, distribution);
  const installNote = androidInstallNote(lang);
  if (es) {
    return {
      title: 'App Android',
      pitch: 'La arena reacciona al mover la mano y al inclinar el móvil.',
      installNote,
      action,
      actionHint,
      dismiss: 'Cerrar el aviso de la app',
    };
  }
  return {
    title: 'Android app',
    pitch: 'The sand reacts to your hand and to tilting the phone.',
    installNote,
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

/** Panel de preferencias. Los interruptores nacen apagados. */
export function panelCookiesCopy(lang: Language) {
  if (lang === 'es') {
    return {
      label: 'Preferencias de cookies',
      google: 'Google Analytics',
      vercel: 'Vercel Analytics',
      save: 'Guardar',
      acceptAll: 'Aceptar todo',
      rejectAll: 'Rechazar todo',
      policy: 'Política de cookies',
      close: 'Cerrar',
    };
  }
  return {
    label: 'Cookie preferences',
    google: 'Google Analytics',
    vercel: 'Vercel Analytics',
    save: 'Save',
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    policy: 'Cookie policy',
    close: 'Close',
  };
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
