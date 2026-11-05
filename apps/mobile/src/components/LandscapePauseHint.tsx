import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { HourglassTheme } from '../theme/theme';

interface Props {
  readonly text: string;
  readonly dismissLabel: string;
  readonly bottom: number;
  readonly font?: string;
  readonly theme: HourglassTheme;
  readonly onDismiss: () => void;
}

/** Pista breve, una sola vez, sobre la pausa al tumbar el móvil. */
export function LandscapePauseHint({ text, dismissLabel, bottom, font, theme, onDismiss }: Props) {
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
            borderColor: theme.ui.line,
            backgroundColor: theme.ui.track,
            boxShadow: theme.ui.pillShadow,
          },
          pressed && styles.pressed,
        ]}
        testID="pista-pausa-apaisada"
      >
        <Animated.Text style={[styles.text, { color: theme.text.hint, fontFamily: font }]}>{text}</Animated.Text>
        <Animated.Text style={[styles.close, { color: theme.ui.inkSoft }]} accessibilityElementsHidden>
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.88 },
  text: {
    flex: 1,
    fontSize: 15,
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
