import { applyLoadedConsent } from './collection';
import type { ConsentRecord } from './consent';
import { loadStoredConsent } from './store';

/**
 * Arranca al importar el módulo (antes de pintar). Así, si el SDK había
 * quedado encendido, se apaga en cuanto se lee que la prueba ya no vale.
 * Un Aceptar vigente se vuelve a aplicar en este arranque.
 */
export const restoredConsent: Promise<ConsentRecord | null> = (async () => {
  try {
    const loaded = await loadStoredConsent();
    await applyLoadedConsent(loaded);
    return loaded.record;
  } catch {
    return null;
  }
})();
