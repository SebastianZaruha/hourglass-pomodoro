/**
 * Ajustes de la web. Misma forma que el móvil (`sanitizeSettings`),
 * pero el sonido nace apagado si todavía no hay nada guardado.
 */
import { DEFAULT_SETTINGS, sanitizeSettings, updateSettings, type Settings } from '@reloj/core';
import { useCallback, useState } from 'react';

export const WEB_SETTINGS_KEY = 'hourglass-web/ajustes';

export function loadWebSettings(storage: Pick<Storage, 'getItem'> = localStorage): Settings {
  try {
    const raw = storage.getItem(WEB_SETTINGS_KEY);
    if (raw === null) return sanitizeSettings({ ...DEFAULT_SETTINGS, sound: false });
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return sanitizeSettings({ ...DEFAULT_SETTINGS, sound: false });
  }
}

export function saveWebSettings(
  settings: Settings,
  storage: Pick<Storage, 'setItem'> = localStorage,
): Settings {
  const clean = sanitizeSettings(settings);
  storage.setItem(WEB_SETTINGS_KEY, JSON.stringify(clean));
  return clean;
}

export type SettingsPatch = Partial<Omit<Settings, 'version' | 'updatedAt'>>;

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadWebSettings());

  const update = useCallback((patch: SettingsPatch | ((current: Settings) => SettingsPatch)) => {
    setSettings((current) => {
      const next = updateSettings(current, typeof patch === 'function' ? patch(current) : patch, Date.now());
      try {
        saveWebSettings(next);
      } catch {
        // Almacenamiento lleno o bloqueado: la sesión sigue en memoria.
      }
      return next;
    });
  }, []);

  return { settings, update };
}
