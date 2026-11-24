/**
 * Texto digital del tiempo, abajo del todo, en un tono muy cercano al fondo
 * (poco contraste, para que el protagonista sea el reloj).
 *
 * Encima puede llevar:
 *  - `label`: la fase de los ciclos («Trabajo 2/4», «Descanso 2/4»; 1.5),
 *  - `hint`: una pista de uso («toca para empezar»...).
 *
 * Los colores cambian suavemente con el tema (`themeProgress`) y todo se
 * desvanece con `opacity` (introducción y menú abierto).
 *
 * Es solo decorativo para la accesibilidad: el lector de pantalla obtiene
 * el tiempo y la fase a través del propio reloj (ver TimerScreen), así
 * evitamos que lo anuncie dos veces.
 */
import { useEffect, useState } from 'react';
import { PixelRatio, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { margenBajoPista } from './menu/vidrioLiquido';
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
  readonly hint: string | null;
  readonly label?: string | null;
  readonly bottom: number;
  readonly fonts: { readonly time?: string; readonly hint?: string; readonly label?: string };
  readonly themeProgress: SharedValue<number>;
  readonly opacity: SharedValue<number>;
  /** Colores de la escena. Sin ellos, los de Clásico. */
  readonly textoClaro?: { readonly time: string; readonly hint: string };
  readonly textoOscuro?: { readonly time: string; readonly hint: string };
}

const L = LIGHT_THEME.text;
const D = DARK_THEME.text;

export function TimeDisplay({
  text,
  refresh = null,
  hint,
  label = null,
  bottom,
  fonts,
  themeProgress,
  opacity,
  textoClaro,
  textoOscuro,
}: Props) {
  const claroTiempo = textoClaro?.time ?? L.time;
  const oscuroTiempo = textoOscuro?.time ?? D.time;
  const claroPista = textoClaro?.hint ?? L.hint;
  const oscuroPista = textoOscuro?.hint ?? D.hint;
  const shown = useLiveText(text, refresh);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  // El borde inferior de la pista: la caja del vidrio más el hueco.
  // Si la fase («Trabajo 2/4») asoma por encima de esa caja, la pista
  // sube justo lo necesario para no montarse sobre ella.
  const escala = Math.min(PixelRatio.getFontScale(), 1.3);
  const altoFase = label ? FASE_LINEA * escala + MARGEN_FASE : 0;
  const sobreVidrio = TIME_LINE_HEIGHT + margenBajoPista(TIME_LINE_HEIGHT);
  const bottomPista = Math.max(sobreVidrio, TIME_LINE_HEIGHT + altoFase);
  const timeColor = useAnimatedStyle(() => ({
    color: interpolateColor(themeProgress.value, [0, 1], [claroTiempo, oscuroTiempo]),
  }));
  const hintColor = useAnimatedStyle(() => ({
    color: interpolateColor(themeProgress.value, [0, 1], [claroPista, oscuroPista]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { bottom }, fade]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {hint ? (
        // Una sola línea, por encima de la pastilla. Encoge en vez de
        // partirse: la segunda línea caería sobre el vidrio.
        <Animated.Text
          style={[styles.hint, { fontFamily: fonts.hint, bottom: bottomPista }, hintColor]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          maxFontSizeMultiplier={1.3}
          testID="pista"
        >
          {hint}
        </Animated.Text>
      ) : null}
      {label ? (
        <Animated.Text
          style={[styles.label, { fontFamily: fonts.label ?? fonts.hint }, timeColor]}
          testID="fase"
        >
          {label}
        </Animated.Text>
      ) : null}
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
function useLiveText(text: string, refresh: (() => string) | null): string {
  const [live, setLive] = useState<{ base: string; value: string } | null>(null);
  useEffect(() => {
    if (!refresh) return;
    const id = setInterval(() => {
      const value = refresh();
      setLive((prev) => (prev && prev.base === text && prev.value === value ? prev : { base: text, value }));
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh, text]);
  // Un valor «vivo» de un texto anterior ya no vale.
  return refresh && live && live.base === text ? live.value : text;
}

/** Alto de la fase sin escalar, y el aire bajo ella. Reserva para no tapar la pista. */
const FASE_LINEA = 22;
const MARGEN_FASE = 2;

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
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: 1.2,
    includeFontPadding: false,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  // Fase de los ciclos: pequeña, espaciada, en el tono del tiempo.
  label: {
    fontSize: 13.5,
    letterSpacing: 2.2,
    marginBottom: MARGEN_FASE,
  },
});
