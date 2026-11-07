/**
 * Ajustes de la web. Misma forma que el móvil (`sanitizeSettings`),
 * pero el sonido nace apagado si todavía no hay nada guardado.
 * `claro` es solo de la web: el núcleo no lo conoce y, al guardar,
 * hay que volver a ponerlo encima de la arena.
 */
import { DEFAULT_SETTINGS, sanitizeSettings, updateSettings, type Settings } from '@reloj/core';
import { useCallback, useState } from 'react';

import { escenaActiva, type EscenaActiva } from './scenes';

export const WEB_SETTINGS_KEY = 'hourglass-web/ajustes';

export interface WebSettings extends Omit<Settings, 'contentId'> {
  readonly contentId: EscenaActiva;
}

/** Primera visita, valor ausente, miel o nieve: lluvia. */
function storedScene(raw: unknown): EscenaActiva {
  if (typeof raw !== 'object' || raw === null) return 'lluvia';
  const id = (raw as { contentId?: unknown }).contentId;
  return escenaActiva(typeof id === 'string' ? id : null);
}

function withScene(settings: Settings, scene: EscenaActiva): WebSettings {
  return { ...settings, contentId: scene };
}

function freshWebSettings(): WebSettings {
  return withScene(
    sanitizeSettings({ ...DEFAULT_SETTINGS, sound: false, language: 'es', contentId: 'lluvia' }),
    'lluvia',
  );
}

export function loadWebSettings(storage: Pick<Storage, 'getItem'> = localStorage): WebSettings {
  try {
    const raw = storage.getItem(WEB_SETTINGS_KEY);
    if (raw === null) return freshWebSettings();
    const parsed: unknown = JSON.parse(raw);
    const scene = storedScene(parsed);
    const settings = sanitizeSettings({
      ...(typeof parsed === 'object' && parsed ? parsed : {}),
      contentId: scene === 'claro' ? 'arena' : scene,
    });
    return withScene(settings, scene);
  } catch {
    return freshWebSettings();
  }
}

export function saveWebSettings(
  settings: WebSettings,
  storage: Pick<Storage, 'setItem'> = localStorage,
): WebSettings {
  const scene = escenaActiva(settings.contentId);
  const clean = sanitizeSettings({ ...settings, contentId: scene === 'claro' ? 'arena' : scene });
  const stored = withScene(clean, scene);
  storage.setItem(WEB_SETTINGS_KEY, JSON.stringify(stored));
  return stored;
}

export type SettingsPatch = Partial<Omit<WebSettings, 'version' | 'updatedAt'>>;

export function useSettings() {
  const [settings, setSettings] = useState<WebSettings>(() => loadWebSettings());

  const update = useCallback((patch: SettingsPatch | ((current: WebSettings) => SettingsPatch)) => {
    setSettings((current) => {
      const raw = typeof patch === 'function' ? patch(current) : patch;
      const scene = raw.contentId ? escenaActiva(raw.contentId) : current.contentId;
      const coreId = scene === 'claro' ? 'arena' : scene;
      const next = updateSettings(
        { ...current, contentId: current.contentId === 'claro' ? 'arena' : current.contentId },
        { ...raw, contentId: coreId },
        Date.now(),
      );
      const web = withScene(next, scene);
      try {
        saveWebSettings(web);
      } catch {
        // Almacenamiento lleno o bloqueado: la sesión sigue en memoria.
      }
      return web;
    });
  }, []);

  return { settings, update };
}
