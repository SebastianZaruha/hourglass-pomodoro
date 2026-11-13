import type { Language, TimerStatus } from '@reloj/core';

import type { AndroidDistribution } from './androidApp';

/** Rótulo grande de la pausa. El inglés es el de los mensajes del reloj. */
export function textoPausa(lang: Language = 'es'): string {
  return lang === 'es' ? 'En pausa' : 'Paused';
}

/** Pistas de ratón. El idioma de la interfaz es el de Ajustes. */

export function hintFor(status: TimerStatus, cyclesFinished: boolean, lang: Language = 'es'): string | null {
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

export function footerCopy(lang: Language = 'es') {
  if (lang === 'es') {
    return {
      legal: 'Aviso legal',
      legalCorto: 'Legal',
      privacy: 'Privacidad',
      privacyCorto: 'Privacidad',
      cookies: 'Cookies',
      cookiesCorto: 'Cookies',
      app: 'App móvil',
      appCorto: 'App',
      settings: 'Configurar cookies',
      settingsCorto: 'Ajustes',
    };
  }
  return {
    legal: 'Legal notice',
    legalCorto: 'Legal',
    privacy: 'Privacy',
    privacyCorto: 'Privacy',
    cookies: 'Cookies',
    cookiesCorto: 'Cookies',
    app: 'Mobile app',
    appCorto: 'App',
    settings: 'Cookie settings',
    settingsCorto: 'Cookies',
  };
}

export const PIE = {
  legal: 'Aviso legal',
  privacy: 'Privacidad',
  cookies: 'Cookies',
  app: 'App móvil',
  settings: 'Configurar cookies',
} as const;

/** Misma URL que ya enlaza la app móvil. El inglés vive en la propia página. */
export const PAGINAS = {
  es: {
    legal: '/aviso-legal.html',
    privacy: '/privacidad.html',
    cookies: '/cookies.html',
    app: '/app-movil.html',
  },
  en: {
    legal: '/legal-notice.html',
    privacy: '/privacy.html',
    cookies: '/cookies-en.html',
    app: '/mobile-app.html',
  },
} as const;

export interface AndroidPromoCopy {
  readonly title: string;
  readonly pitch: string;
  /** Aviso breve sobre Play Protect al instalar fuera de Google Play. */
  readonly installNote: string;
  readonly action: string;
  readonly actionHint: string;
  readonly dismiss: string;
}

const NOTA_INSTALACION =
  'Fuera de Google Play, Android puede avisarte (Play Protect o fuentes desconocidas). ' +
  'Es normal al instalar un APK directo del desarrollador.';

/** Aviso discreto de la app Android. El botón depende de dónde se descarga. */
export function androidPromoCopy(distribution: AndroidDistribution, lang: Language = 'es'): AndroidPromoCopy {
  const es = lang === 'es';
  const action =
    distribution === 'play-store' ? (es ? 'Play Store' : 'Google Play') : es ? 'Descargar' : 'Download';
  const actionHint =
    distribution === 'play-store'
      ? es
        ? 'Abrir en Google Play'
        : 'Open in Google Play'
      : es
        ? 'Descargar el APK desde GitHub Releases'
        : 'Download the APK from GitHub Releases';
  if (!es) {
    return {
      title: 'Android app',
      pitch: 'The sand reacts to your hand and to tilting the phone.',
      installNote:
        'Outside Google Play, Android may warn you (Play Protect or unknown sources). ' +
        'That’s normal for a direct APK from the developer.',
      action,
      actionHint,
      dismiss: 'Dismiss the app notice',
    };
  }
  return {
    title: 'App Android',
    pitch: 'La arena reacciona al mover la mano y al inclinar el móvil.',
    installNote: NOTA_INSTALACION,
    action,
    actionHint,
    dismiss: 'Cerrar el aviso de la app',
  };
}

/** Texto del banner, tal como lo dejó el abogado (banner-cookies-copy.md). */
export function bannerCopy(lang: Language = 'es') {
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
