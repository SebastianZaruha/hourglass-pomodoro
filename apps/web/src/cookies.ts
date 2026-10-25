/**
 * Elección de cookies (banner). Se guarda unos 12 meses.
 * Rechazar no carga Google Analytics; aceptar sí, y solo entonces.
 */
export const CONSENT_KEY = 'hourglass-web/cookies';

/** ~12 meses. Pasado este plazo se vuelve a preguntar. */
export const CONSENT_MAX_AGE_MS = Math.round(365.25 * 24 * 60 * 60 * 1000);

export type ConsentChoice = 'accepted' | 'rejected';

export interface ConsentRecord {
  readonly choice: ConsentChoice;
  readonly at: number;
}

export function parseConsent(raw: string | null, now = Date.now()): ConsentRecord | null {
  if (raw === null || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed.choice !== 'accepted' && parsed.choice !== 'rejected') return null;
    if (typeof parsed.at !== 'number' || !Number.isFinite(parsed.at)) return null;
    if (now - parsed.at > CONSENT_MAX_AGE_MS || parsed.at > now + 60_000) return null;
    return { choice: parsed.choice, at: parsed.at };
  } catch {
    return null;
  }
}

export function serializeConsent(choice: ConsentChoice, now = Date.now()): string {
  const record: ConsentRecord = { choice, at: now };
  return JSON.stringify(record);
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
): void {
  storage.setItem(CONSENT_KEY, serializeConsent(choice, now));
}
