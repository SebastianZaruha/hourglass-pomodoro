import type { Language } from '@reloj/core';

/** Política de la app (no la de la web). La revisa el abogado antes del APK. */
export const PRIVACY_APP_URL: Readonly<Record<Language, string>> = {
  es: 'https://hourglass.sebastianzaruha.com/privacidad-app.html',
  en: 'https://hourglass.sebastianzaruha.com/privacy-app.html',
};
