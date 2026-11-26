/**
 * Dígitos del tiempo, abajo del todo, dentro de la pastilla de vidrio.
 * Lo que se lee encima (pista, fase, fin, ayuda) no va aquí: vive en
 * SobreElVidrio, para no montarse sobre el panel.
 *
 * Los colores cambian suavemente con el tema (`themeProgress`) y todo se
 * desvanece con `opacity` (introducción y menú abierto).
 *
 * Es solo decorativo para la accesibilidad: el lector de pantalla obtiene
 * el tiempo y la fase a través del propio reloj (ver TimerScreen), así
 * evitamos que lo anuncie dos veces.
 */
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { DARK_THEME, LIGHT_THEME } from '../theme/theme';

/**
 * Alto de línea del tiempo (px). Fijo para que mida lo mismo en Android, iOS
 * y web; TimerScreen lo usa para colocar el texto (ver TIME_BOTTOM).
 */
export const TIME_LINE_HEIGHT = 44;

/** Cada cuánto se mira si el texto ha cambiado mientras corre el tiempo (ms). */
const REFRESH_MS = 250;

interface Props {
  /** Texto en el último render de la pantalla. */
  readonly text: string;
  /**
   * Mientras corre el tiempo (1.8.1), el texto se pide aquí cada 250 ms y
   * solo se re-renderiza ESTE componente (y solo si cambia, una vez por
   * segundo). Así la pantalla entera no se vuelve a pintar 4 veces por segundo.
   */
  readonly refresh?: (() => string) | null;
  readonly startedAt: number | null;
  readonly bottom: number;
  readonly fonts: { readonly time?: string };
  readonly themeProgress: SharedValue<number>;
  readonly opacity: SharedValue<number>;
  /** Colores de la escena. Sin ellos, los de Clásico. */
  readonly textoClaro?: { readonly time: string };
  readonly textoOscuro?: { readonly time: string };
}

const L = LIGHT_THEME.text;
const D = DARK_THEME.text;

export function TimeDisplay({
  text,
  refresh = null,
  startedAt,
  bottom,
  fonts,
  themeProgress,
  opacity,
  textoClaro,
  textoOscuro,
}: Props) {
  const claroTiempo = textoClaro?.time ?? L.time;
  const oscuroTiempo = textoOscuro?.time ?? D.time;
  const shown = useLiveText(text, refresh, startedAt);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const timeColor = useAnimatedStyle(() => ({
    color: interpolateColor(themeProgress.value, [0, 1], [claroTiempo, oscuroTiempo]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { bottom }, fade]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.Text style={[styles.time, { fontFamily: fonts.time }, timeColor]} testID="tiempo">
        {shown}
      </Animated.Text>
    </Animated.View>
  );
}

/**
 * El texto que se ve: el de la pantalla o, mientras hay `refresh`, el que
 * devuelve cada REFRESH_MS. Si la pantalla manda un texto nuevo (pausa,
 * cambio de fase...), se usa ese al momento.
 */
function useLiveText(text: string, refresh: (() => string) | null, startedAt: number | null): string {
  const [live, setLive] = useState<{ base: string; value: string; startedAt: number | null } | null>(null);
  useEffect(() => {
    if (!refresh) return;
    const id = setInterval(() => {
      const value = refresh();
      setLive((prev) =>
        prev?.startedAt === startedAt && prev.base === text && prev.value === value
          ? prev
          : { base: text, value, startedAt },
      );
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh, startedAt, text]);
  // Un valor «vivo» de un texto anterior ya no vale.
  return refresh && live?.startedAt === startedAt && live.base === text ? live.value : text;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // 1.6: un pelín más grandes (tiempo 30 → 34, textos 12 → 13,5; ~12 %).
  time: {
    fontSize: 34,
    lineHeight: TIME_LINE_HEIGHT,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
});
