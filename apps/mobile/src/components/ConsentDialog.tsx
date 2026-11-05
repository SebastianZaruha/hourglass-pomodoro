/**
 * Primera capa del consentimiento. Aceptar y Rechazar pesan igual (mismo
 * tamaño, mismo borde, mismo tipo): rechazar no puede ser el botón pequeño.
 * En el primer arranque, «atrás» cuenta como Rechazar. Si se abre desde
 * Ajustes, «atrás» cierra sin cambiar la elección.
 */
import { useEffect } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { bannerCopy } from '../consent/bannerCopy';
import type { ConsentChoice } from '../consent/consent';
import { announce } from '../hooks/useScreenReader';
import { useLanguage } from '../i18n/I18n';
import type { HourglassTheme } from '../theme/theme';
import type { MenuFonts } from './menu/themedStyles';

const VEIL = { light: 'rgba(235, 229, 221, 0.92)', dark: 'rgba(32, 27, 23, 0.92)' } as const;

interface Props {
  readonly visible: boolean;
  /** true si ya hay una elección: se puede cerrar sin cambiarla. */
  readonly dismissible: boolean;
  readonly saving: boolean;
  readonly onChoose: (choice: ConsentChoice) => void;
  readonly onDismiss: () => void;
  readonly onPrivacy: () => void;
  readonly theme: HourglassTheme;
  readonly fonts: MenuFonts;
  readonly safeTop: number;
  readonly safeBottom: number;
}

export function ConsentDialog({
  visible,
  dismissible,
  saving,
  onChoose,
  onDismiss,
  onPrivacy,
  theme,
  fonts,
  safeTop,
  safeBottom,
}: Props) {
  const copy = bannerCopy(useLanguage());

  useEffect(() => {
    if (visible) announce(copy.title);
  }, [visible, copy.title]);

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === 'web') {
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || saving) return;
        if (dismissible) onDismiss();
        else onChoose('rejected');
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving) return true;
      if (dismissible) onDismiss();
      else onChoose('rejected');
      return true;
    });
    return () => sub.remove();
  }, [visible, dismissible, saving, onChoose, onDismiss]);

  if (!visible) return null;

  const paragraphs = copy.body.split('\n\n');
  const ink = theme.ui.ink;
  const soft = theme.ui.inkSoft;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.veil,
        { backgroundColor: VEIL[theme.scheme], paddingTop: safeTop + 24, paddingBottom: safeBottom + 24 },
      ]}
      accessibilityViewIsModal
      testID="consentimiento"
    >
      <View style={[styles.card, { backgroundColor: theme.ui.tooltip }]}>
        <Text style={[styles.title, { fontFamily: fonts.semibold, color: ink }]} accessibilityRole="header">
          {copy.title}
        </Text>
        {paragraphs.map((paragraph) => (
          <Text key={paragraph} style={[styles.body, { fontFamily: fonts.regular, color: ink }]}>
            {paragraph}
          </Text>
        ))}
        <Text style={[styles.morePrefix, { fontFamily: fonts.regular, color: soft }]}>{copy.morePrefix}</Text>
        <Pressable
          onPress={onPrivacy}
          disabled={saving}
          accessibilityRole="link"
          accessibilityLabel={copy.more}
          style={({ pressed }) => [styles.privacy, pressed && styles.pressed]}
          testID="consentimiento-privacidad"
        >
          <Text style={[styles.privacyText, { fontFamily: fonts.medium, color: ink }]}>{copy.more}</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            onPress={() => onChoose('rejected')}
            disabled={saving}
            accessibilityRole="button"
            style={({ pressed }) => [styles.choice, { borderColor: soft }, pressed && styles.pressed]}
            testID="consentimiento-rechazar"
          >
            <Text style={[styles.choiceText, { fontFamily: fonts.medium, color: ink }]}>{copy.reject}</Text>
          </Pressable>
          <Pressable
            onPress={() => onChoose('accepted')}
            disabled={saving}
            accessibilityRole="button"
            style={({ pressed }) => [styles.choice, { borderColor: soft }, pressed && styles.pressed]}
            testID="consentimiento-aceptar"
          >
            <Text style={[styles.choiceText, { fontFamily: fonts.medium, color: ink }]}>{copy.accept}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { justifyContent: 'center', paddingHorizontal: 22, zIndex: 30 },
  card: {
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  title: { fontSize: 20, lineHeight: 26, marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  morePrefix: { fontSize: 14, lineHeight: 20 },
  privacy: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
  privacyText: { fontSize: 15, textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  choice: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  choiceText: { fontSize: 16 },
  pressed: { opacity: 0.55 },
});
