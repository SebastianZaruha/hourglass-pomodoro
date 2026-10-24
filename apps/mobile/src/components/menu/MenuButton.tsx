/**
 * Botón del menú: sin borde ni fondo, dos rayitas finas (la de abajo más
 * corta) en un tono muy cercano al fondo. Se nota lo justo: el protagonista
 * es el reloj.
 *
 * Sitio (1.8.10): abajo a la derecha, cerca del pulgar, para usarlo con una
 * mano. Las rayas van centradas en su zona táctil, por encima de la barra
 * de gestos y por debajo de la línea del tiempo (que va centrada, lejos de
 * la esquina): no tapan ningún control del reloj.
 * Con la hoja abierta el botón se esconde (la hoja tapa esa zona; se cierra
 * tocando fuera, arrastrando, con «atrás» o con el asa «Cerrar ajustes»).
 *
 * Área táctil (1.6): TODA la zona de guarda de la esquina (MENU_GUARD_SIZE
 * desde el borde y desde el margen seguro de abajo, más ese margen), aunque
 * el dibujo mida 20 × 9: mucho más de 48 dp. En esa zona los gestos del reloj
 * no hacen nada (ver TimerScreen), así que un toque ahí solo abre el menú,
 * nunca empieza ni pausa el tiempo.
 */
import { MENU_GUARD_SIZE } from '@reloj/core';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useT } from '../../i18n/I18n';
import { useThemedBackground } from './themedStyles';

/** Centro de las rayas sobre el margen seguro de abajo: el de la zona táctil. */
export const MENU_ICON_CENTER = MENU_GUARD_SIZE / 2;

interface Props {
  /** Margen seguro de abajo (barra de gestos) de la capa del menú. */
  readonly safeBottom: number;
  /** ¿Hoja abierta? Entonces el botón no está (ni para el dedo ni para el lector). */
  readonly hidden: boolean;
  readonly onPress: () => void;
  /** Opacidad (introducción, ayuda y hoja abierta). */
  readonly opacity: SharedValue<number>;
  readonly themeProgress: SharedValue<number>;
}

export function MenuButton({ safeBottom, hidden, onPress, opacity, themeProgress }: Props) {
  const t = useT();
  const line = useThemedBackground(themeProgress, 'menuIcon');
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  // Rayas: la larga 4 px por encima del centro, la corta 4 px por debajo.
  const center = safeBottom + MENU_ICON_CENTER;
  return (
    <Animated.View
      style={[styles.wrap, fade]}
      pointerEvents={hidden ? 'none' : 'box-none'}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}
    >
      <Pressable
        onPress={onPress}
        disabled={hidden}
        style={({ pressed }) => [
          styles.button,
          { height: safeBottom + MENU_GUARD_SIZE },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t.settings}
        accessibilityHint={t.openSettings}
        aria-expanded={false}
        testID="boton-menu"
      >
        <Animated.View style={[styles.line, { bottom: center + 3.25, width: 20 }, line]} />
        <Animated.View style={[styles.line, { bottom: center - 4.75, width: 13 }, line]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, right: 0 },
  button: { width: MENU_GUARD_SIZE },
  pressed: { opacity: 0.5 },
  // Rayas a 24 px del borde derecho, como cuando estaba arriba.
  line: { position: 'absolute', right: 24, height: 1.5, borderRadius: 1 },
});
