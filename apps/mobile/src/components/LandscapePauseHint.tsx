import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { VIDRIO } from './menu/vidrioLiquido';
import { useThemedText, type PaletaUi } from './menu/themedStyles';
import type { HourglassTheme } from '../theme/theme';

interface Props {
  readonly text: string;
  readonly dismissLabel: string;
  readonly bottom: number;
  readonly font?: string;
  readonly theme: HourglassTheme;
  readonly themeProgress: SharedValue<number>;
  readonly paleta?: PaletaUi;
  readonly pistaClaro: string;
  readonly pistaOscuro: string;
  readonly onDismiss: () => void;
}

/** Pista breve, una sola vez, sobre la pausa al tumbar el móvil. */
export function LandscapePauseHint({
  text,
  dismissLabel,
  bottom,
  font,
  theme,
  themeProgress,
  paleta,
  pistaClaro,
  pistaOscuro,
  onDismiss,
}: Props) {
  const cierre = useThemedText(themeProgress, 'inkSoft', paleta);
  const pista = useAnimatedStyle(() => ({
    color: interpolateColor(themeProgress.value, [0, 1], [pistaClaro, pistaOscuro]),
  }));
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={[styles.wrap, { bottom }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={`${text}. ${dismissLabel}`}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: theme.scheme === 'dark' ? VIDRIO.tinteOscuro : VIDRIO.tinteClaro,
            opacity: 0.92,
          },
          pressed && styles.pressed,
        ]}
        testID="pista-pausa-apaisada"
      >
        <Animated.Text style={[styles.text, { fontFamily: font }, pista]}>{text}</Animated.Text>
        <Animated.Text style={[styles.close, cierre]} accessibilityElementsHidden>
          ×
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 999,
  },
  pressed: { opacity: 0.88 },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  close: {
    fontSize: 20,
    lineHeight: 22,
    paddingHorizontal: 2,
  },
});
