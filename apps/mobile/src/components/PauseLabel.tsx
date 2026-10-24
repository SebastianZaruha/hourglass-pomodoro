/**
 * Rótulo grande «Pausa», centrado sobre el reloj.
 *
 * Aparece en las DOS pausas (1.6):
 *  - al tumbar el móvil de lado (≈90°): se gira 90° hacia ese lado, para
 *    que se lea en horizontal desde la posición en la que está la persona;
 *  - al pausar con un toque: derecho (antes solo se veía un texto pequeño
 *    abajo y pasaba desapercibido).
 *
 * Estilo (1.3.1): 38 px, espaciado 8, un tono algo más contrastado que el
 * del tiempo (theme.text.pause) y un halo suave (sombra de texto difuminada,
 * theme.text.pauseGlow) que lo separa del reloj. Entra y sale con un
 * fundido y un ligero cambio de tamaño (con «reducir movimiento», solo el
 * fundido, más corto). Sigue montado mientras se desvanece.
 *
 * Pista (1.8.6): con el móvil de lado el reloj sigue en pausa aunque se
 * toque; entonces sale debajo, pequeña y girada con el rótulo, «ponlo de pie
 * para seguir» (`note`).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { HourglassTheme } from '../theme/theme';

interface Props {
  readonly visible: boolean;
  /**
   * Hacia dónde se ha tumbado el móvil: 1 = derecha, -1 = izquierda.
   * 0 = no está tumbado (pausa con el dedo): el rótulo va derecho.
   */
  readonly sideSign: 1 | -1 | 0;
  readonly theme: HourglassTheme;
  readonly font?: string;
  /** Texto («Pausa» / «Paused»). */
  readonly text: string;
  readonly reduceMotion?: boolean;
  /** Pista pequeña debajo del rótulo (o null). */
  readonly note?: string | null;
}

export function PauseLabel({
  visible,
  sideSign,
  theme,
  font,
  text,
  reduceMotion = false,
  note = null,
}: Props) {
  // Montado mientras se ve O se está desvaneciendo; el giro se congela al
  // salir para que no salte a «derecho» a mitad del fundido.
  const [mounted, setMounted] = useState(visible);
  const [shownSide, setShownSide] = useState(sideSign);
  if (visible && !mounted) setMounted(true); // estado derivado (en el render)
  if (visible && shownSide !== sideSign) setShownSide(sideSign);

  const shown = useSharedValue(0);
  useEffect(() => {
    if (!mounted) return;
    const hide = () => setMounted(false);
    shown.set(
      withTiming(visible ? 1 : 0, { duration: visible ? 260 : reduceMotion ? 120 : 200 }, (finished) => {
        'worklet';
        if (finished && !visible) scheduleOnRN(hide);
      }),
    );
  }, [visible, mounted, reduceMotion, shown]);

  const rotate = shownSide > 0 ? '-90deg' : shownSide < 0 ? '90deg' : '0deg';
  const anim = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ rotate }, { scale: reduceMotion ? 1 : 0.94 + 0.06 * shown.value }],
  }));

  // La pista entra y sale con un fundido (se recuerda el último texto para el fundido de salida).
  const noteShown = useSharedValue(0);
  const [noteText, setNoteText] = useState(note);
  if (note !== null && note !== noteText) setNoteText(note);
  useEffect(() => {
    noteShown.set(withTiming(note !== null ? 1 : 0, { duration: reduceMotion ? 0 : 220 }));
  }, [note, reduceMotion, noteShown]);
  const noteAnim = useAnimatedStyle(() => ({ opacity: noteShown.value * shown.value }));

  return (
    <View
      pointerEvents="none"
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {mounted ? (
        <Animated.View style={[styles.group, anim]}>
          <Animated.Text
            style={[
              styles.text,
              {
                color: theme.text.pause,
                // Halo: sin desplazamiento y muy difuminado (no una sombra dura).
                // Las tres propiedades van juntas en el mismo objeto: en web,
                // react-native-web solo crea la sombra si las ve juntas.
                textShadowColor: theme.text.pauseGlow,
                textShadowOffset: GLOW_OFFSET,
                textShadowRadius: GLOW_RADIUS,
                fontFamily: font,
              },
            ]}
            testID="rotulo-pausa"
          >
            {text}
          </Animated.Text>
          {noteText ? (
            <Animated.Text
              style={[
                styles.note,
                {
                  color: theme.text.pause,
                  textShadowColor: theme.text.pauseGlow,
                  textShadowOffset: GLOW_OFFSET,
                  textShadowRadius: NOTE_GLOW_RADIUS,
                  fontFamily: font,
                },
                noteAnim,
              ]}
              testID="pista-de-pie"
            >
              {noteText}
            </Animated.Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Halo centrado y difuminado detrás del rótulo. */
const GLOW_OFFSET = { width: 0, height: 0 } as const;
const GLOW_RADIUS = 18;
const NOTE_GLOW_RADIUS = 10;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { alignItems: 'center' },
  note: {
    fontSize: 16,
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  text: {
    fontSize: 38,
    letterSpacing: 8,
    // Margen para que el halo no se recorte en Android.
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
