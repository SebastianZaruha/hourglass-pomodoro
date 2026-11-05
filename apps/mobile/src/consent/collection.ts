import type { ConsentChoice, LoadedConsent } from './consent';
import type { TimerEventName, TimerEventParams, UsageContext } from './events';

/**
 * iOS y web: esta app no inicializa Firebase ahí (solo hay `google-services.json`
 * de Android). La recogida no existe; la interfaz sigue igual.
 */
export async function applyLoadedConsent(_loaded: LoadedConsent): Promise<void> {}

export async function applyChoice(_choice: ConsentChoice, _reset: boolean): Promise<void> {}

export async function logTimerEvent(_name: TimerEventName, _params: TimerEventParams): Promise<void> {}

export async function setUsageContext(_context: UsageContext): Promise<void> {}
