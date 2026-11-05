import type { Language } from '@reloj/core';

/**
 * Primera capa del consentimiento (texto legal, ES y EN).
 * La huella de estos textos es `BANNER_VERSION`: si cambia el texto, se vuelve a preguntar.
 * Origen: borrador 4.A / 4.B (2026-11-05). Un solo Aceptar / Rechazar cubre
 * Analytics y Crashlytics.
 */
export interface BannerCopy {
  readonly title: string;
  readonly body: string;
  readonly morePrefix: string;
  readonly more: string;
  readonly accept: string;
  readonly reject: string;
}

const es: BannerCopy = {
  title: 'Ayúdanos a mejorar Hourglass',
  body: 'Usamos Firebase (Google) solo si lo aceptas, para entender cómo se usa la app y detectar fallos. Esto implica identificadores del dispositivo e información técnica; puede haber transferencia a Estados Unidos bajo el Data Privacy Framework.\n\nPuedes rechazar y seguir usando Hourglass igual. Puedes cambiarlo cuando quieras en Ajustes.',
  morePrefix: 'Más información:',
  more: 'Política de privacidad',
  accept: 'Aceptar',
  reject: 'Rechazar',
};

const en: BannerCopy = {
  title: 'Help us improve Hourglass',
  body: 'We use Firebase (Google) only if you agree, to understand how the app is used and to detect crashes. This involves device identifiers and technical information; data may be transferred to the United States under the Data Privacy Framework.\n\nYou can decline and keep using Hourglass as usual. You can change this anytime in Settings.',
  morePrefix: 'More information:',
  more: 'Privacy Policy',
  accept: 'Accept',
  reject: 'Decline',
};

const COPY: Readonly<Record<Language, BannerCopy>> = { es, en };

export function bannerCopy(lang: Language): BannerCopy {
  return COPY[lang];
}

/** Texto que entra en la huella (lo que se muestra, en los dos idiomas). */
export function bannerFingerprintText(): string {
  return (['es', 'en'] as const)
    .map((lang) => {
      const copy = bannerCopy(lang);
      return `${copy.title}\n${copy.body}\n${copy.morePrefix} ${copy.more}`;
    })
    .join('\n');
}
