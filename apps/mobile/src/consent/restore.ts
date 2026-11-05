import type { ConsentRecord } from './consent';

/** iOS y web no restauran Firebase. */
export const restoredConsent: Promise<ConsentRecord | null> = Promise.resolve(null);
