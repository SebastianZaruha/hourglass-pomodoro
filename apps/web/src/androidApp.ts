/**
 * Descarga de la app Android.
 *
 * Hoy: APK de GitHub Releases (etiqueta fija + nombre del asset).
 * Mañana, Play Store: cambia `distribution` a `'play-store'` y `url` por la
 * ficha. El botón («Descargar» / «Play Store») sale de `androidPromoCopy`.
 *
 * `releases/download/<etiqueta>/<archivo>` no se mueve cuando sale otra
 * etiqueta. La v1.8.12 publica `hourglass-pomodoro-1.8.12.apk`.
 * Para colgar otro APK, ver README › «App de navegador».
 */
export const ANDROID_DISTRIBUTIONS = ['github-release', 'play-store'] as const;
export type AndroidDistribution = (typeof ANDROID_DISTRIBUTIONS)[number];

/** Release que lleva el APK enlazado desde la web. */
export const ANDROID_RELEASE = {
  repo: 'SebastianZaruha/hourglass-pomodoro',
  tag: 'v1.8.12',
  asset: 'hourglass-pomodoro-1.8.12.apk',
} as const;

/** Enlace directo al asset de una release (no a la página de la release). */
export function githubReleaseApkUrl(release: {
  readonly repo: string;
  readonly tag: string;
  readonly asset: string;
}): string {
  return `https://github.com/${release.repo}/releases/download/${release.tag}/${release.asset}`;
}

export const ANDROID_APP: {
  readonly distribution: AndroidDistribution;
  readonly url: string;
} = {
  distribution: 'github-release',
  url: githubReleaseApkUrl(ANDROID_RELEASE),
};

/**
 * Si en cada release se adjunta además una copia con este nombre fijo,
 * se puede usar `releases/latest/download/` y no tocar la web en cada versión.
 */
export const ANDROID_APK_STABLE_NAME = 'hourglass-pomodoro.apk';

export function githubLatestApkUrl(repo: string, asset = ANDROID_APK_STABLE_NAME): string {
  return `https://github.com/${repo}/releases/latest/download/${asset}`;
}

/** Aviso cerrado. Un solo flag; no es consentimiento de cookies. */
export const ANDROID_PROMO_KEY = 'hourglass-web/android-promo';

export function readAndroidPromoDismissed(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  try {
    return storage.getItem(ANDROID_PROMO_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeAndroidPromoDismissed(storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(ANDROID_PROMO_KEY, '1');
  } catch {
    // Modo privado o cuota: el aviso puede volver en la siguiente visita.
  }
}

/**
 * ¿El aviso puede estar en el DOM?
 * La pausa no entra aquí: con `.is-paused` el CSS lo oculta, como el pie legal,
 * y así al seguir no se vuelve a animar la entrada.
 * El banner de cookies, el menú y el aviso legal lo apartan para no taparlos.
 */
export function androidPromoOpen(input: {
  readonly settled: boolean;
  readonly dismissed: boolean;
  readonly bannerOpen: boolean;
  readonly menuOpen: boolean;
  readonly legalOpen: boolean;
}): boolean {
  return input.settled && !input.dismissed && !input.bannerOpen && !input.menuOpen && !input.legalOpen;
}
