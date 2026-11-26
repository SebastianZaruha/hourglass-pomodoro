/**
 * Carga y guarda los ajustes del usuario a través de la interfaz
 * `SettingsStore` del core (hoy respaldada por AsyncStorage).
 */
import {
  DEFAULT_SETTINGS,
  LocalSettingsStore,
  updateSettings,
  type Settings,
  type SettingsStore,
} from '@reloj/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { asyncStorageAdapter } from '../storage/asyncStorageAdapter';

// Una única instancia para toda la app.
const defaultStore: SettingsStore = new LocalSettingsStore(asyncStorageAdapter);

export interface UseSettings {
  readonly settings: Settings;
  /** true cuando ya se han leído los ajustes guardados. */
  readonly ready: boolean;
  readonly update: (patch: Partial<Omit<Settings, 'version' | 'updatedAt'>>) => void;
}

export function useSettings(store: SettingsStore = defaultStore): UseSettings {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((loaded) => {
        if (!cancelled && loaded.updatedAt >= current.current.updatedAt) {
          current.current = loaded;
          setSettings(loaded);
        }
      })
      .catch((error: unknown) => console.warn('No se pudieron leer los ajustes', error))
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    // Si en el futuro llegan cambios desde otro dispositivo, los aplicamos.
    const unsubscribe = store.subscribe((s) => {
      // El almacén también notifica nuestras escrituras ya completadas.
      if (cancelled || s.updatedAt <= current.current.updatedAt) return;
      current.current = s;
      setSettings(s);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store]);

  const update = useCallback(
    (patch: Partial<Omit<Settings, 'version' | 'updatedAt'>>) => {
      const now = Math.max(Date.now(), current.current.updatedAt + 1);
      const next = updateSettings(current.current, patch, now);
      current.current = next;
      setSettings(next);
      pendingWrite.current = pendingWrite.current
        .then(() => store.save(next))
        .catch((error: unknown) => console.warn('No se pudieron guardar los ajustes', error));
    },
    [store],
  );

  return { settings, ready, update };
}
