/**
 * Todo lo que se lee encima del reloj (pista, fin, fase, ayuda, aviso)
 * cuelga de aquí. El borde inferior del bloque es el borde superior de
 * la pastilla más `huecoPista`. Nada de esta pila puede volver a
 * apoyarse en el vidrio: cada línea es una sola y el bloque crece hacia arriba.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { TIME_LINE_HEIGHT } from './TimeDisplay';
import { margenBajoPista } from './menu/vidrioLiquido';

interface ContenedorProps {
  /**
   * El mismo `bottom` que los dígitos: px desde el borde inferior de
   * la pantalla hasta el borde inferior de la línea del tiempo.
   */
  readonly bottom: number;
  readonly children: ReactNode;
  readonly pointerEvents?: 'none' | 'box-none' | 'auto';
}

export function SobreElVidrio({ bottom, children, pointerEvents = 'box-none' }: ContenedorProps) {
  return (
    <View
      pointerEvents={pointerEvents}
      style={[styles.pila, { bottom: bottom + TIME_LINE_HEIGHT + margenBajoPista(TIME_LINE_HEIGHT) }]}
    >
      {children}
    </View>
  );
}

interface LineaProps {
  readonly text: string;
  readonly fontFamily?: string;
  readonly themeProgress: SharedValue<number>;
  readonly claro: string;
  readonly oscuro: string;
  /** Espaciado. La fase va más abierta que la pista. */
  readonly letra?: number;
  readonly testID?: string;
}

/** Una línea de la pila. Encoge; no se parte en dos sobre el vidrio. */
export function LineaSobreReloj({
  text,
  fontFamily,
  themeProgress,
  claro,
  oscuro,
  letra = 1.2,
  testID,
}: LineaProps) {
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(themeProgress.value, [0, 1], [claro, oscuro]),
  }));
  return (
    <Animated.Text
      style={[styles.linea, { fontFamily, letterSpacing: letra }, color]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      maxFontSizeMultiplier={1.3}
      testID={testID}
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  pila: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  linea: {
    alignSelf: 'stretch',
    fontSize: 13.5,
    lineHeight: 18,
    includeFontPadding: false,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
});
