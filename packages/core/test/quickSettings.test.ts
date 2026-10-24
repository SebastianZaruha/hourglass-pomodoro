import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  LANGUAGE_CYCLE,
  THEME_CYCLE,
  en,
  es,
  languageShort,
  languageSpoken,
  nextInCycle,
  sanitizeSettings,
  themeSpoken,
  updateSettings,
} from '../src';

describe('fila de ajustes rápidos (1.8.8)', () => {
  it('Tema rota Claro → Oscuro → Automático → Claro', () => {
    expect(nextInCycle(THEME_CYCLE, 'light')).toBe('dark');
    expect(nextInCycle(THEME_CYCLE, 'dark')).toBe('system');
    expect(nextInCycle(THEME_CYCLE, 'system')).toBe('light');
  });

  it('Idioma rota Español → English → Automático → Español', () => {
    expect(nextInCycle(LANGUAGE_CYCLE, 'es')).toBe('en');
    expect(nextInCycle(LANGUAGE_CYCLE, 'en')).toBe('system');
    expect(nextInCycle(LANGUAGE_CYCLE, 'system')).toBe('es');
  });

  it('el lector dice el valor actual («Tema: Oscuro»)', () => {
    expect(themeSpoken(es, 'dark')).toBe('Tema: Oscuro');
    expect(themeSpoken(en, 'system')).toBe('Theme: Automatic');
    expect(languageSpoken(es, 'en')).toBe('Idioma: English');
    expect(languageSpoken(en, 'es')).toBe('Language: Español');
    expect(es.tapToChange).toBe('Toca para cambiar');
    expect(en.tapToChange).toBe('Tap to change');
  });

  it('texto corto del botón de idioma', () => {
    expect(languageShort(es, 'es')).toBe('ES');
    expect(languageShort(en, 'en')).toBe('EN');
    expect(languageShort(es, 'system')).toBe('Auto');
  });

  it('el último modo de sesión (pestaña) se recuerda al volver a abrir', () => {
    const cycles = updateSettings(DEFAULT_SETTINGS, { sessionMode: 'cycles' }, 1);
    const reread = sanitizeSettings(JSON.parse(JSON.stringify(cycles)));
    expect(reread.sessionMode).toBe('cycles');
    const single = updateSettings(reread, { sessionMode: 'single' }, 2);
    expect(sanitizeSettings(JSON.parse(JSON.stringify(single))).sessionMode).toBe('single');
  });
});
