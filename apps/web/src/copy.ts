import type { TimerStatus } from '@reloj/core';

import type { AndroidDistribution } from './androidApp';

/**
 * Textos de la interfaz. La web va siempre en español: el idioma
 * solo se elige dentro de las páginas legales.
 */

export function hintFor(status: TimerStatus, cyclesFinished: boolean): string | null {
  if (status === 'idle') return 'clic para empezar · rueda para el tiempo';
  if (status === 'paused') return 'clic para seguir · arrastra el reloj para voltearlo';
  if (status === 'finished') {
    return cyclesFinished ? 'ciclos completados · clic para empezar' : 'clic para volver a empezar';
  }
  return null;
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
export function androidPromoCopy(distribution: AndroidDistribution): AndroidPromoCopy {
  const action = distribution === 'play-store' ? 'Play Store' : 'Descargar';
  const actionHint =
    distribution === 'play-store' ? 'Abrir en Google Play' : 'Descargar el APK desde GitHub Releases';
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
export function bannerCopy() {
  return {
    body: 'Usamos cookies técnicas necesarias y, solo si aceptas, cookies de analítica de Google Analytics para saber cómo se usa la web. Vercel Web Analytics, también solo si aceptas, mide visitas sin cookies. Puedes cambiar tu elección cuando quieras en «Configurar cookies».',
    accept: 'Aceptar',
    reject: 'Rechazar',
    more: 'Configurar',
    label: 'Cookies',
  };
}
