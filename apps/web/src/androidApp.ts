/**
 * Descarga de la app Android.
 *
 * Hoy: `releases/latest/download/<archivo>` en SebastianZaruha/hourglass-pomodoro.
 * Ese enlace sigue a la última release que lleve ese nombre de asset.
 * La v1.8.12 publica `hourglass-pomodoro-1.8.12.apk`.
 * Mañana, Play Store: `distribution: 'play-store'` y la URL de la ficha.
 * El botón («Descargar» / «Play Store») sale de `androidPromoCopy`.
 * Para colgar otro APK, ver README › «App de navegador».
 */
export const ANDROID_DISTRIBUTIONS = ['github-release', 'play-store'] as const;
export type AndroidDistribution = (typeof ANDROID_DISTRIBUTIONS)[number];

export const ANDROID_REPO = 'SebastianZaruha/hourglass-pomodoro';

/**
 * Nombre exacto del asset en GitHub Releases.
 * La release latest (v1.8.12) adjunta este archivo. Si la siguiente release
 * cambia el nombre, actualiza esta constante, o sube el APK siempre con
 * el mismo nombre para no tocar la web.
 */
export const ANDROID_APK_ASSET = 'hourglass-pomodoro-1.8.12.apk';

/** `releases/latest/download/<archivo>`: el APK de la última release con ese nombre. */
export function githubLatestApkUrl(repo: string, asset: string): string {
  return `https://github.com/${repo}/releases/latest/download/${asset}`;
}

/** Enlace fijo a una etiqueta, por si hace falta no seguir a `latest`. */
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
  url: githubLatestApkUrl(ANDROID_REPO, ANDROID_APK_ASSET),
};

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
