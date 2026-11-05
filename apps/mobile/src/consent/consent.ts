import { bannerFingerprintText } from './bannerCopy';

/**
 * Prueba local del consentimiento de Firebase (Analytics + Crashlytics).
 * Misma idea que la web (`apps/web/src/cookies.ts`): elección, momento y
 * huella del texto. Aquí además los flags (los dos van juntos: opción A)
 * y la versión de la app.
 *
 * Rechazar no activa la recogida. Un texto nuevo o más de ~12 meses
 * invalidan la prueba y hay que volver a preguntar.
 */
export const CONSENT_KEY = 'hourglass-android/firebase-consent';

/** ~12 meses. Pasado este plazo se vuelve a preguntar. */
export const CONSENT_MAX_AGE_MS = Math.round(365.25 * 24 * 60 * 60 * 1000);

/** Huella estable del texto del diálogo (es y en). Si cambia, se vuelve a preguntar. */
export const BANNER_VERSION = fnv1a(bannerFingerprintText());

export type ConsentChoice = 'accepted' | 'rejected';

export interface ConsentRecord {
  readonly choice: ConsentChoice;
  readonly at: number;
  readonly bannerVersion: string;
  /** Firebase Analytics. Con la opción A coincide con `choice`. */
  readonly analytics: boolean;
  /** Firebase Crashlytics. Con la opción A coincide con `choice`. */
  readonly crashlytics: boolean;
  /** Versión de la app en el momento de la elección (prueba, no invalida). */
  readonly appVersion: string;
}

export interface ConsentStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

export interface LoadedConsent {
  readonly record: ConsentRecord | null;
  /** Había un valor guardado, aunque parsearlo no dé una prueba vigente. */
  readonly hadStoredValue: boolean;
  /** AsyncStorage falló: no podemos demostrar el consentimiento. */
  readonly unreadable: boolean;
}

/** Qué hacer con el SDK a partir de lo guardado. No toca Firebase. */
export type CollectionAction =
  | { readonly type: 'leave-default' }
  | { readonly type: 'grant' }
  | { readonly type: 'deny'; readonly reset: boolean };

function fnv1a(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function flagsFor(choice: ConsentChoice): Pick<ConsentRecord, 'analytics' | 'crashlytics'> {
  const on = choice === 'accepted';
  return { analytics: on, crashlytics: on };
}

export function consentRecord(
  choice: ConsentChoice,
  at: number,
  appVersion: string,
  bannerVersion = BANNER_VERSION,
): ConsentRecord {
  return { choice, at, bannerVersion, appVersion, ...flagsFor(choice) };
}

export function parseConsent(
  raw: string | null,
  now = Date.now(),
  version = BANNER_VERSION,
): ConsentRecord | null {
  if (raw === null || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed.choice !== 'accepted' && parsed.choice !== 'rejected') return null;
    if (typeof parsed.at !== 'number' || !Number.isFinite(parsed.at)) return null;
    if (now - parsed.at > CONSENT_MAX_AGE_MS || parsed.at > now + 60_000) return null;
    if (typeof parsed.bannerVersion !== 'string' || parsed.bannerVersion !== version) return null;
    if (typeof parsed.appVersion !== 'string' || !/^[0-9A-Za-z.+-]{1,32}$/.test(parsed.appVersion))
      return null;
    const on = parsed.choice === 'accepted';
    if (parsed.analytics !== on || parsed.crashlytics !== on) return null;
    return {
      choice: parsed.choice,
      at: parsed.at,
      bannerVersion: parsed.bannerVersion,
      analytics: parsed.analytics,
      crashlytics: parsed.crashlytics,
      appVersion: parsed.appVersion,
    };
  } catch {
    return null;
  }
}

export function serializeConsent(
  choice: ConsentChoice,
  at = Date.now(),
  appVersion: string,
  version = BANNER_VERSION,
): string {
  return JSON.stringify(consentRecord(choice, at, appVersion, version));
}

export async function loadConsent(storage: ConsentStorage, now = Date.now()): Promise<LoadedConsent> {
  try {
    const raw = await storage.getItem(CONSENT_KEY);
    const text = typeof raw === 'string' ? raw : null;
    return {
      record: parseConsent(text, now),
      hadStoredValue: text !== null && text.trim() !== '',
      unreadable: false,
    };
  } catch {
    return { record: null, hadStoredValue: false, unreadable: true };
  }
}

export async function writeConsent(
  choice: ConsentChoice,
  storage: ConsentStorage,
  at: number,
  appVersion: string,
): Promise<ConsentRecord> {
  const record = consentRecord(choice, at, appVersion);
  await storage.setItem(CONSENT_KEY, JSON.stringify(record));
  return record;
}

/**
 * Primera instalación: no llamar al SDK (el manifest ya niega la recogida).
 * Aceptado vigente: conceder. Rechazado vigente: denegar sin borrar.
 * Texto caducado o distinto, o almacenamiento ilegible: denegar.
 * Si había una prueba que ya no vale, además se pide borrar lo local.
 */
export function collectionAction(loaded: LoadedConsent): CollectionAction {
  if (loaded.record?.choice === 'accepted') return { type: 'grant' };
  if (loaded.record?.choice === 'rejected') return { type: 'deny', reset: false };
  if (loaded.unreadable) return { type: 'deny', reset: false };
  if (loaded.hadStoredValue) return { type: 'deny', reset: true };
  return { type: 'leave-default' };
}
