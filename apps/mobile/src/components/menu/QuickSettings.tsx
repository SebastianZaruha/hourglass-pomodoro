/**
 * Fila de ajustes rápidos del menú (1.8.8, disposición «B»): UNA fila de
 * botones redondos al pie de la hoja.
 *
 *   [Tema] [Idioma]  │  [Sonido] [Vibración] [Ventana flotante]
 *
 *   - Tema e Idioma son botones que ROTAN al tocarlos (ver quickSettings en
 *     el core). El lector dice el valor actual («Tema: Oscuro») con la pista
 *     «Toca para cambiar», y al cambiarlo anuncia el nuevo.
 *   - Sonido, Vibración y Ventana flotante son interruptores redondos: rol
 *     `switch` con su estado; encendidos, rellenos del color de acento.
 *
 * Iconos: trazos finos dibujados con Skia (como los de la ayuda de gestos,
 * sin dependencias nuevas). Su color sale de `themeProgress` en el hilo de
 * la interfaz, así que se funde con el resto del menú al cambiar de tema (en
 * la maqueta cambiaba de golpe).
 *
 * Área táctil: 48 × 48 dp como mínimo.
 *
 * Etiquetas (1.8.10): mantener pulsado un botón enseña encima una etiqueta
 * pequeña con su nombre («Sonido», «Tema»…, los mismos textos del lector de
 * pantalla), y al soltar el botón NO se activa. Si el dedo se va del botón
 * antes de soltar, tampoco (como en Android). La lógica está en el core
 * (`QuickPress`, `tooltipLeft`); aquí, el dibujo (`QuickTooltip`) y el
 * estado compartido por la fila (`useQuickTooltip`).
 */
import { QuickPress, TOOLTIP_DELAY_MS, TOOLTIP_HIDE_MS, tooltipLeft } from '@reloj/core';
import { Canvas, Path, interpolateColors } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { playSelectionTick } from '../../haptics/haptics';

import { DARK_THEME, LIGHT_THEME, type UiPalette } from '../../theme/theme';
import { circle } from '../InfoScreen';
import { useThemedBackground, type MenuFonts, type MenuStyles } from './themedStyles';

// ─── Iconos (caja de 32 × 32) ────────────────────────────────────────────────

const SPEAKER = 'M5 12.5 H10 L16.5 7 V25 L10 19.5 H5 Z';
const ICONS = {
  soundOn: `${SPEAKER} M20.5 12 A5.5 5.5 0 0 1 20.5 20 M24 8.5 A10.5 10.5 0 0 1 24 23.5`,
  soundOff: `${SPEAKER} M21 12.5 L28 19.5 M28 12.5 L21 19.5`,
  vibration:
    'M12.5 6 H19.5 A2 2 0 0 1 21.5 8 V24 A2 2 0 0 1 19.5 26 H12.5 A2 2 0 0 1 10.5 24 V8 A2 2 0 0 1 12.5 6 Z M6.5 11 V21 M3 13.5 V18.5 M25.5 11 V21 M29 13.5 V18.5',
  floating:
    'M6 6 H26 A2.5 2.5 0 0 1 28.5 8.5 V23.5 A2.5 2.5 0 0 1 26 26 H6 A2.5 2.5 0 0 1 3.5 23.5 V8.5 A2.5 2.5 0 0 1 6 6 Z M16.5 15 H24.5 V22 H16.5 Z',
  sun: `${circle(16, 16, 5)} M16 3.5 V6.5 M16 25.5 V28.5 M3.5 16 H6.5 M25.5 16 H28.5 M7.2 7.2 L9.3 9.3 M22.7 22.7 L24.8 24.8 M7.2 24.8 L9.3 22.7 M22.7 9.3 L24.8 7.2`,
  moon: 'M24.5 19.5 A10 10 0 1 1 12.5 7.5 A8 8 0 0 0 24.5 19.5 Z',
  auto: `${circle(16, 16, 10)} M16 6 V26`,
} as const;
/** Partes rellenas (la mitad oscura de «Automático», el cuadro flotante). */
const FILLS: Partial<Record<keyof typeof ICONS, string>> = {
  auto: 'M16 6 A10 10 0 0 1 16 26 Z',
  floating: 'M16.5 15 H24.5 V22 H16.5 Z',
};
export type IconName = keyof typeof ICONS;

export const themeIcon = (v: 'light' | 'dark' | 'system'): IconName =>
  v === 'light' ? 'sun' : v === 'dark' ? 'moon' : 'auto';

/** Color del tema que se funde con `progress` (0 claro, 1 oscuro), en el hilo de la interfaz. */
function useThemedColor(progress: SharedValue<number>, key: keyof UiPalette) {
  const light = LIGHT_THEME.ui[key];
  const dark = DARK_THEME.ui[key];
  return useDerivedValue(() => interpolateColors(progress.value, [0, 1], [light, dark]));
}

function Icon({
  name,
  size,
  progress,
  colorKey,
}: {
  name: IconName;
  size: number;
  progress: SharedValue<number>;
  colorKey: keyof UiPalette;
}) {
  const color = useThemedColor(progress, colorKey);
  const transform = [{ scale: size / 32 }];
  const fill = FILLS[name];
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Path
        path={ICONS[name]}
        style="stroke"
        strokeWidth={1.6}
        strokeCap="round"
        strokeJoin="round"
        color={color}
        transform={transform}
      />
      {fill ? <Path path={fill} color={color} transform={transform} /> : null}
    </Canvas>
  );
}

// ─── Botón redondo ──────────────────────────────────────────────────────────

/** Diámetro del botón (y su área táctil): 48 dp. */
export const ROUND_SIZE = 48;
const ICON_SIZE = 22;

interface RoundProps {
  readonly icon?: IconName;
  /** En vez de icono, un texto corto («ES»). */
  readonly glyph?: string;
  /** Interruptor: true / false. Botón que rota: undefined. */
  readonly value?: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly styles: MenuStyles;
  readonly fonts: MenuFonts;
  readonly progress: SharedValue<number>;
  readonly pillShadow: string;
  readonly testID?: string;
  /** Nombre corto del control para la etiqueta de la pulsación larga («Sonido»). */
  readonly tooltip?: string;
  /** Etiqueta compartida por la fila (ver useQuickTooltip). */
  readonly tip?: QuickTooltipControl;
}

export function RoundButton({
  icon,
  glyph,
  value,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  styles: s,
  fonts,
  progress,
  pillShadow,
  testID,
  tooltip,
  tip,
}: RoundProps) {
  const isSwitch = value !== undefined;
  const on = value === true;
  // Una pulsación a la vez por botón (estado al momento, no de React).
  const [press] = useState(() => new QuickPress());
  // Centro del botón dentro de la fila (para colocar la etiqueta encima).
  const center = useRef(ROUND_SIZE / 2);
  const onLayout = (e: LayoutChangeEvent) => {
    center.current = e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2;
  };
  const point = (e: GestureResponderEvent) => [e.nativeEvent.pageX, e.nativeEvent.pageY] as const;
  const withTip = tooltip !== undefined && tip !== undefined;
  return (
    <Pressable
      onLayout={onLayout}
      onPressIn={(e) => press.begin(...point(e))}
      onPressMove={(e) => press.move(...point(e))}
      onLongPress={
        withTip
          ? () => {
              if (!press.longPress()) return;
              playSelectionTick();
              tip.show(tooltip, center.current);
            }
          : undefined
      }
      delayLongPress={TOOLTIP_DELAY_MS}
      onPressOut={withTip ? () => tip.release() : undefined}
      // Pressable ya no llama a onPress tras una pulsación larga ni si el dedo
      // se suelta lejos; QuickPress además cancela en cuanto el dedo se va.
      onPress={() => {
        if (press.release() === 'activate') onPress();
      }}
      style={({ pressed }) => [st.touch, pressed && st.pressed]}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      aria-checked={isSwitch ? on : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <Animated.View
        style={[
          st.round,
          on ? s.accentBg : isSwitch ? s.trackBg : s.pillBg,
          !isSwitch && { boxShadow: pillShadow },
        ]}
      >
        {icon ? (
          <Icon
            name={icon}
            size={ICON_SIZE}
            progress={progress}
            colorKey={on ? 'onAccent' : isSwitch ? 'inkSoft' : 'ink'}
          />
        ) : (
          <Animated.Text style={[st.glyph, { fontFamily: fonts.semibold }, s.ink]} numberOfLines={1}>
            {glyph}
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Etiqueta de la pulsación larga (1.8.10) ────────────────────────────────

export interface QuickTooltipControl {
  /** Enseña `label` centrada sobre `center` (x dentro de la fila). */
  readonly show: (label: string, center: number) => void;
  /** El dedo se levanta: la etiqueta se va en TOOLTIP_HIDE_MS. */
  readonly release: () => void;
  /** Fuera ya (la hoja se cierra). */
  readonly hide: () => void;
}

interface TooltipState {
  readonly label: string;
  readonly center: number;
  readonly visible: boolean;
}

/** Estado de la etiqueta, uno para toda la fila. */
export function useQuickTooltip(): { state: TooltipState; control: QuickTooltipControl } {
  const [state, setState] = useState<TooltipState>({ label: '', center: 0, visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback((label: string, center: number) => {
    clear();
    setState({ label, center, visible: true });
  }, []);
  const release = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), TOOLTIP_HIDE_MS);
  }, []);
  const hide = useCallback(() => {
    clear();
    setState((s) => (s.visible ? { ...s, visible: false } : s));
  }, []);
  useEffect(() => clear, []);
  const control = useMemo(() => ({ show, release, hide }), [show, release, hide]);
  return { state, control };
}

interface TooltipProps {
  readonly state: TooltipState;
  /** Ancho de la fila (para no salirse por los lados). */
  readonly rowWidth: number;
  readonly styles: MenuStyles;
  readonly fonts: MenuFonts;
  readonly progress: SharedValue<number>;
  readonly shadow: string;
}

/** Separación entre la etiqueta y el botón (dp). */
const TOOLTIP_GAP = 8;

/**
 * La etiqueta: una píldora pequeña del color de la hoja (beige cálido en el
 * claro, gris tostado en el oscuro) con el texto del menú, encima del botón.
 * Solo para la vista: el lector de pantalla ya dice el nombre de cada botón.
 */
export function QuickTooltip({ state, rowWidth, styles: s, fonts, progress, shadow }: TooltipProps) {
  const reduceMotion = useReducedMotion();
  const bg = useThemedBackground(progress, 'tooltip');
  // Ancho medido de la etiqueta actual: hasta medirla se dibuja invisible.
  const [measured, setMeasured] = useState({ label: '', width: 0 });
  const ready = measured.label === state.label && measured.width > 0;
  const shown = state.visible && ready;
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.set(withTiming(shown ? 1 : 0, { duration: reduceMotion ? 0 : shown ? 120 : 180 }));
  }, [shown, reduceMotion, fade]);
  const anim = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - fade.value) * 4 }],
  }));
  const left = ready ? tooltipLeft(state.center, measured.width, rowWidth) : 0;
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={(e) => {
        const width = e.nativeEvent.layout.width;
        if (measured.label !== state.label || Math.abs(measured.width - width) > 0.5)
          setMeasured({ label: state.label, width });
      }}
      style={[st.tooltip, { left, boxShadow: shadow }, bg, anim]}
      testID="etiqueta-rapida"
    >
      <Animated.Text style={[st.tooltipText, { fontFamily: fonts.semibold }, s.ink]} numberOfLines={1}>
        {state.label}
      </Animated.Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  touch: { width: ROUND_SIZE, height: ROUND_SIZE, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  round: {
    width: ROUND_SIZE,
    height: ROUND_SIZE,
    borderRadius: ROUND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 13.5, letterSpacing: 0.4 },
  tooltip: {
    position: 'absolute',
    bottom: ROUND_SIZE + TOOLTIP_GAP,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
  },
  tooltipText: { fontSize: 12.5, letterSpacing: 0.3 },
});
