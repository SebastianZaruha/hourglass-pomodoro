/**
 * Fila de ajustes rápidos del menú (1.8.8): Tema e Idioma son botones
 * redondos que ROTAN al tocarlos (Claro → Oscuro → Automático → Claro…), y
 * lo que dicen (a la vista y al lector de pantalla) sale de aquí.
 */
import { LANGUAGE_NAMES, type LanguagePreference, type Messages } from '../i18n/messages';
import type { ThemePreference } from '../settings/settings';

/** Orden de giro del botón de Tema. */
export const THEME_CYCLE: readonly ThemePreference[] = ['light', 'dark', 'system'];
/** Orden de giro del botón de Idioma. */
export const LANGUAGE_CYCLE: readonly LanguagePreference[] = ['es', 'en', 'system'];

/** El siguiente valor del ciclo (uno desconocido vuelve al primero). */
export function nextInCycle<T>(order: readonly T[], value: T): T {
  const i = order.indexOf(value);
  return order[(i + 1) % order.length]!;
}

export function themeName(t: Messages, v: ThemePreference): string {
  return v === 'light' ? t.themeLight : v === 'dark' ? t.themeDark : t.automatic;
}

/** «Español» / «English» en su propio idioma; «Automático» en el actual. */
export function languageName(t: Messages, v: LanguagePreference): string {
  return v === 'system' ? t.automatic : LANGUAGE_NAMES[v];
}

/** Texto dentro del botón redondo de Idioma: «ES», «EN» o «Auto». */
export function languageShort(t: Messages, v: LanguagePreference): string {
  return v === 'system' ? t.automaticShort : v.toUpperCase();
}

/** «Tema: Oscuro» (etiqueta del botón y aviso al cambiarlo). */
export function themeSpoken(t: Messages, v: ThemePreference): string {
  return t.settingValue(t.theme, themeName(t, v));
}

/** «Idioma: English». */
export function languageSpoken(t: Messages, v: LanguagePreference): string {
  return t.settingValue(t.language, languageName(t, v));
}
