/**
 * Ajustes de la web. Misma forma que el móvil (`sanitizeSettings`),
 * pero el sonido nace apagado si todavía no hay nada guardado.
 */
import { DEFAULT_SETTINGS, sanitizeSettings, updateSettings, type Settings } from '@reloj/core';
import { useCallback, useState } from 'react';

export const WEB_SETTINGS_KEY = 'hourglass-web/ajustes';

const WEB_SCENES = ['arena', 'lluvia', 'miel', 'nieve'] as const;

/** Primera visita, valor ausente o escena desconocida: lluvia. */
function storedScene(raw: unknown): (typeof WEB_SCENES)[number] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const id = (raw as { contentId?: unknown }).contentId;
  for (const scene of WEB_SCENES) if (scene === id) return scene;
  return null;
}

function freshWebSettings(): Settings {
  return sanitizeSettings({ ...DEFAULT_SETTINGS, sound: false, language: 'es', contentId: 'lluvia' });
}

export function loadWebSettings(storage: Pick<Storage, 'getItem'> = localStorage): Settings {
  try {
    const raw = storage.getItem(WEB_SETTINGS_KEY);
    if (raw === null) return freshWebSettings();
    const parsed: unknown = JSON.parse(raw);
    const scene = storedScene(parsed) ?? 'lluvia';
    const settings = sanitizeSettings(parsed);
    return settings.contentId === scene ? settings : { ...settings, contentId: scene };
  } catch {
    return freshWebSettings();
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
