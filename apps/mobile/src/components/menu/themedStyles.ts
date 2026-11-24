/**
 * Colores del menú que cambian SUAVEMENTE con el tema.
 *
 * `progress` va de 0 (claro) a 1 (oscuro) (ver useAppTheme). Cada estilo es
 * un `useAnimatedStyle` que mezcla el color claro y el oscuro con
 * `interpolateColor`: se calcula en el hilo de UI, sin re-renderizar React.
 *
 * Se crean UNA vez en la hoja y se pasan a los controles, en vez de que cada
 * control cree los suyos (así hay ~12 estilos animados, no cientos).
 */
import { interpolateColors } from '@shopify/react-native-skia';
import { interpolateColor, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { DARK_THEME, LIGHT_THEME, type UiPalette } from '../../theme/theme';

type Key = keyof UiPalette;
const L = LIGHT_THEME.ui;
const D = DARK_THEME.ui;

/** Claro y oscuro de la escena. Sin ella, los de Clásico (los mismos objetos). */
export interface PaletaUi {
  readonly claro: UiPalette;
  readonly oscuro: UiPalette;
}

/** Estilo animado de color de texto. */
export function useThemedText(progress: SharedValue<number>, key: Key, paleta?: PaletaUi) {
  const light = (paleta?.claro ?? L)[key];
  const dark = (paleta?.oscuro ?? D)[key];
  return useAnimatedStyle(() => ({ color: interpolateColor(progress.value, [0, 1], [light, dark]) }));
}

/** Estilo animado de color de fondo. */
export function useThemedBackground(progress: SharedValue<number>, key: Key, paleta?: PaletaUi) {
  const light = (paleta?.claro ?? L)[key];
  const dark = (paleta?.oscuro ?? D)[key];
  return useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [light, dark]),
  }));
}

/** Color de trazo Skia que se funde con el mismo `progress` que el texto. */
export function useThemedSkiaColor(progress: SharedValue<number>, key: Key, paleta?: PaletaUi) {
  const light = (paleta?.claro ?? L)[key];
  const dark = (paleta?.oscuro ?? D)[key];
  return useDerivedValue(() => interpolateColors(progress.value, [0, 1], [light, dark]));
}

/** Estilo animado de color de borde. */
export function useThemedBorder(progress: SharedValue<number>, key: Key, paleta?: PaletaUi) {
  const light = (paleta?.claro ?? L)[key];
  const dark = (paleta?.oscuro ?? D)[key];
  return useAnimatedStyle(() => ({ borderColor: interpolateColor(progress.value, [0, 1], [light, dark]) }));
}

/** Todos los estilos que usan los controles del menú. */
export function useMenuStyles(progress: SharedValue<number>, paleta?: PaletaUi) {
  return {
    ink: useThemedText(progress, 'ink', paleta),
    inkSoft: useThemedText(progress, 'inkSoft', paleta),
    label: useThemedText(progress, 'label', paleta),
    trackBg: useThemedBackground(progress, 'track', paleta),
    pillBg: useThemedBackground(progress, 'pill', paleta),
    accentBg: useThemedBackground(progress, 'accent', paleta),
    lineBg: useThemedBackground(progress, 'line', paleta),
    inkSoftBg: useThemedBackground(progress, 'inkSoft', paleta),
    lineBorder: useThemedBorder(progress, 'inkSoft', paleta),
    grabberBg: useThemedBackground(progress, 'grabber', paleta),
    // Fondo transparente, también como estilo animado. En la web, si un
    // estilo animado desaparece del array, su color se queda «pegado»; por
    // eso el segmento NO seleccionado usa este en vez de ningún estilo.
    clearBg: useAnimatedStyle(() => ({ backgroundColor: 'transparent' })),
  };
}

export type MenuStyles = ReturnType<typeof useMenuStyles>;

/** Familias tipográficas de Manrope cargadas en App.tsx (cada peso es una familia). */
export interface MenuFonts {
  readonly regular?: string;
  readonly medium?: string;
  readonly semibold?: string;
  readonly light?: string;
}
