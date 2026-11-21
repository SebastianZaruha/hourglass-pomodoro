import { bannerCopy } from '../../tiempo';

/**
 * Elección de cookies (banner). Se guarda unos 12 meses, ligada al texto
 * que se mostró. Rechazar no carga analítica; aceptar sí, y solo entonces.
 */
export const CONSENT_KEY = 'hourglass-web/cookies';

/** ~12 meses. Pasado este plazo se vuelve a preguntar. */
export const CONSENT_MAX_AGE_MS = Math.round(365.25 * 24 * 60 * 60 * 1000);

/** Huella estable del texto del banner (es y en). Si cambia, se vuelve a preguntar. */
export const BANNER_VERSION = fnv1a(`${bannerCopy('es').body}\n${bannerCopy('en').body}`);

export type ConsentChoice = 'accepted' | 'rejected' | 'custom';

/** Cada herramienta, por separado. Apagadas salvo que se enciendan. */
export interface AnalyticsPrefs {
  readonly google: boolean;
  readonly vercel: boolean;
}

export interface ConsentRecord {
  readonly choice: ConsentChoice;
  readonly at: number;
  readonly bannerVersion: string;
  readonly google?: boolean;
  readonly vercel?: boolean;
}

function fnv1a(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function parseConsent(
  raw: string | null,
  now = Date.now(),
  version = BANNER_VERSION,
): ConsentRecord | null {
  if (raw === null || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed.choice !== 'accepted' && parsed.choice !== 'rejected' && parsed.choice !== 'custom') return null;
    if (typeof parsed.at !== 'number' || !Number.isFinite(parsed.at)) return null;
    if (now - parsed.at > CONSENT_MAX_AGE_MS || parsed.at > now + 60_000) return null;
    // Sin versión, o de otro texto: se vuelve a mostrar el banner.
    if (typeof parsed.bannerVersion !== 'string' || parsed.bannerVersion !== version) return null;
    if (parsed.choice === 'custom' && (typeof parsed.google !== 'boolean' || typeof parsed.vercel !== 'boolean')) {
      return null;
    }
    return {
      choice: parsed.choice,
      at: parsed.at,
      bannerVersion: parsed.bannerVersion,
      ...(typeof parsed.google === 'boolean' ? { google: parsed.google } : {}),
      ...(typeof parsed.vercel === 'boolean' ? { vercel: parsed.vercel } : {}),
    };
  } catch {
    return null;
  }
}

export function serializeConsent(
  choice: ConsentChoice,
  now = Date.now(),
  version = BANNER_VERSION,
  prefs?: AnalyticsPrefs,
): string {
  const record: ConsentRecord = { choice, at: now, bannerVersion: version };
  if (choice !== 'custom') return JSON.stringify(record);
  return JSON.stringify({ ...record, google: prefs?.google === true, vercel: prefs?.vercel === true });
}

/** Lo guardado, herramienta a herramienta. Sin elección, null. */
export function preferenciasDe(record: ConsentRecord | null): AnalyticsPrefs | null {
  if (!record) return null;
  if (record.choice === 'accepted') return { google: true, vercel: true };
  if (record.choice === 'rejected') return { google: false, vercel: false };
  return { google: record.google === true, vercel: record.vercel === true };
}

export function eleccionDe(prefs: AnalyticsPrefs): ConsentChoice {
  if (prefs.google && prefs.vercel) return 'accepted';
  if (!prefs.google && !prefs.vercel) return 'rejected';
  return 'custom';
}

export function readConsent(
  storage: Pick<Storage, 'getItem'> = localStorage,
  now = Date.now(),
): ConsentRecord | null {
  try {
    return parseConsent(storage.getItem(CONSENT_KEY), now);
  } catch {
    return null;
  }
}

export function writeConsent(
  choice: ConsentChoice,
  storage: Pick<Storage, 'setItem'> = localStorage,
  now = Date.now(),
  prefs?: AnalyticsPrefs,
): void {
  storage.setItem(CONSENT_KEY, serializeConsent(choice, now, BANNER_VERSION, prefs));
}
