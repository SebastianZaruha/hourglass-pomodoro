/**
 * Controles del menú de ajustes: selector segmentado, chips, stepper y la
 * barra de minutos de «Personalizado» en sesión única.
 * (Los interruptores de Sonido, Vibración y Ventana flotante son botones
 * redondos desde la 1.8.8, ver QuickSettings.) Todos:
 *  - tienen un área táctil de al menos 44 px (con `hitSlop` donde el dibujo
 *    es más pequeño, p. ej. los botones − / + del stepper),
 *  - exponen rol, estado y etiqueta a TalkBack / VoiceOver,
 *  - usan los colores animados de `MenuStyles` (cambian suave con el tema).
 */
import {
  DURATION_STEPS_MIN,
  MINUTE_MS,
  StepTicker,
  durationFromDrag,
  nearestStepIndex,
  stepToDuration,
} from '@reloj/core';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { playSelectionTick } from '../../haptics';
import { useLatest } from '../../hooks/useLatest';
import { useT } from '../../i18n/I18n';
import type { MenuFonts, MenuStyles } from './themedStyles';

/**
 * Píxeles de arrastre horizontal por escalón. El mismo paso que el deslizamiento
 * vertical del reloj y que la barra de la web (`SCRUB_PX`).
 */
const PX_PER_STEP = 18;

interface Base {
  readonly styles: MenuStyles;
  readonly fonts: MenuFonts;
  /** Sombra de la opción elegida (cambia con el tema; no se anima). */
  readonly pillShadow: string;
}

// ─── Selector segmentado (Tema; Sesión única / Ciclos) ──────────────────────

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedProps<T extends string> extends Base {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Nombre del grupo para el lector de pantalla («Tema»). */
  readonly accessibilityLabel: string;
  /** Prefijo de los testID de cada opción (por defecto «opcion»). */
  readonly testID?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID = 'opcion',
  styles: s,
  fonts,
  pillShadow,
}: SegmentedProps<T>) {
  return (
    <Animated.View
      style={[st.segTrack, s.trackBg]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={st.segItem}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 3, bottom: 3 }}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={o.label}
            testID={`${testID}-${o.value}`}
          >
            <Animated.View style={[st.segPill, on ? s.pillBg : s.clearBg, on && { boxShadow: pillShadow }]}>
              <Animated.Text
                style={[
                  st.segText,
                  { fontFamily: on ? fonts.semibold : fonts.medium },
                  on ? s.ink : s.inkSoft,
                ]}
                numberOfLines={1}
              >
                {o.label}
              </Animated.Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

// ─── Chip (tiempos rápidos, preajustes de ciclo) ────────────────────────────

interface ChipProps extends Base {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  /** Lo que lee el lector de pantalla («25 minutos»). */
  readonly accessibilityLabel: string;
  readonly round?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  round = false,
  style,
  styles: s,
  fonts,
  pillShadow,
  testID,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[round ? st.chipRound : st.chip, style]}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          round ? st.chipRoundBg : st.chipBg,
          selected ? s.pillBg : s.trackBg,
          selected && { boxShadow: pillShadow },
        ]}
      />
      <Animated.Text
        style={[
          round ? st.chipRoundText : st.chipText,
          { fontFamily: selected ? fonts.semibold : fonts.regular },
          selected ? s.ink : s.inkSoft,
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

// ─── Stepper (Trabajo, Descanso, Rondas) ────────────────────────────────────

interface StepperProps extends Base {
  /** «Trabajo», «Descanso», «Rondas». */
  readonly label: string;
  readonly value: number;
  /** Unidad pequeña junto al número («min»), o nada. */
  readonly unit?: string;
  /** Texto completo para el lector de pantalla («25 minutos»). */
  readonly spoken: string;
  readonly onStep: (delta: 1 | -1) => void;
  readonly canDecrement: boolean;
  readonly canIncrement: boolean;
  readonly testID?: string;
}

/**
 * Para TalkBack es UN control «ajustable» (desliza arriba/abajo para cambiar
 * el valor); para el dedo, dos botones − / + de 26 px dibujados con 44 px de
 * área táctil.
 */
export function Stepper({
  label,
  value,
  unit,
  spoken,
  onStep,
  canDecrement,
  canIncrement,
  styles: s,
  fonts,
  testID,
}: StepperProps) {
  const t = useT();
  return (
    <View
      style={st.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      aria-valuetext={spoken}
      aria-valuenow={value}
      accessibilityActions={[
        { name: 'increment', label: t.more },
        { name: 'decrement', label: t.less },
      ]}
      onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      testID={testID}
    >
      <View style={st.stepRow}>
        <StepButton
          glyph="−"
          enabled={canDecrement}
          onPress={() => onStep(-1)}
          styles={s}
          fonts={fonts}
          testID={testID && `${testID}-menos`}
        />
        <Animated.Text style={[st.stepValue, { fontFamily: fonts.light }, s.ink]} numberOfLines={1}>
          {value}
          {unit ? (
            <Animated.Text style={[st.stepUnit, { fontFamily: fonts.medium }, s.inkSoft]}>
              {' '}
              {unit}
            </Animated.Text>
          ) : null}
        </Animated.Text>
        <StepButton
          glyph="+"
          enabled={canIncrement}
          onPress={() => onStep(1)}
          styles={s}
          fonts={fonts}
          testID={testID && `${testID}-mas`}
        />
      </View>
      <Animated.Text style={[st.stepLabel, { fontFamily: fonts.medium }, s.inkSoft]}>{label}</Animated.Text>
    </View>
  );
}

interface DurationSliderProps extends Base {
  /** Duración guardada, en milisegundos. Se muestra en el escalón más cercano. */
  readonly durationMs: number;
  /** «Sesión» / «Session». */
  readonly label: string;
  readonly onChangeDuration: (durationMs: number) => void;
  /**
   * Gesto que cierra la hoja al arrastrar hacia abajo. La barra lo bloquea
   * mientras el dedo va en horizontal, así cambiar los minutos no baja el
   * menú. No afecta al reloj: con la hoja abierta ese gesto está apagado, y
   * este solo recibe toques que empiezan sobre la propia barra.
   */
  readonly blockSheet: ReturnType<typeof usePanGesture>;
  readonly testID?: string;
}

/**
 * Barra de minutos de sesión única «Personalizado», a todo el ancho: − a la
 * izquierda, el valor en el centro, + a la derecha. Arrastrar en horizontal
 * recorre los mismos escalones que el reloj (1–180 min). Un movimiento claro
 * hacia arriba o abajo no cambia el tiempo: lo suelta para que la hoja pueda
 * cerrarse o desplazarse.
 */
export function DurationSlider({
  durationMs,
  label,
  onChangeDuration,
  blockSheet,
  styles: s,
  fonts,
  testID,
}: DurationSliderProps) {
  const t = useT();
  const latest = useLatest({ durationMs, onChangeDuration });
  const startMs = useRef(0);
  const sentMs = useRef(0);
  const swallowPress = useRef(false);
  const scrubId = useRef(0);
  const swallowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<StepTicker | null>(null);
  ticker.current ??= new StepTicker();

  useEffect(
    () => () => {
      if (swallowTimer.current) clearTimeout(swallowTimer.current);
    },
    [],
  );

  // Una sola configuración: si el objeto cambiara en cada minuto, Gesture
  // Handler volvería a registrar el gesto a mitad del dedo y el arrastre se
  // cortaría. El gesto de la hoja es un objeto nuevo cada render, pero su
  // handlerTag no cambia: la relación se ata a ese tag.
  const sheetTag = blockSheet.handlerTag;
  const pan = usePanGesture(
    useMemo(() => {
      const endScrub = () => {
        const id = scrubId.current;
        if (swallowTimer.current) clearTimeout(swallowTimer.current);
        const timer = setTimeout(() => {
          // Un arrastre nuevo ya habrá subido el id: no le quites el «trago».
          if (scrubId.current === id) swallowPress.current = false;
          if (swallowTimer.current === timer) swallowTimer.current = null;
        }, 32);
        swallowTimer.current = timer;
      };
      return {
        runOnJS: true,
        maxPointers: 1,
        activeOffsetX: [-8, 8] as [number, number],
        // Por encima de esto, en vertical, el gesto falla y la hoja puede
        // cerrarse o la lista desplazarse. Por debajo, manda el eje horizontal.
        failOffsetY: [-16, 16] as [number, number],
        shouldCancelWhenOutside: false,
        block: blockSheet,
        onActivate: () => {
          scrubId.current += 1;
          const start = stepToDuration(nearestStepIndex(latest.current.durationMs));
          startMs.current = start;
          sentMs.current = start;
          ticker.current?.reset(start);
          // El dedo pudo bajar sobre − o +: ese toque no debe contar como un paso.
          swallowPress.current = true;
        },
        onUpdate: (event: { translationX: number }) => {
          const next = durationFromDrag(startMs.current, event.translationX, PX_PER_STEP);
          if (next === sentMs.current) return;
          sentMs.current = next;
          if (ticker.current?.update(next, Date.now())) playSelectionTick();
          latest.current.onChangeDuration(next);
        },
        onDeactivate: endScrub,
        onFinalize: endScrub,
      };
      // blockSheet se captura con el tag; el resto vive en refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheetTag]),
  );

  const index = nearestStepIndex(durationMs);
  const shown = DURATION_STEPS_MIN[index] ?? Math.round(durationMs / MINUTE_MS);
  const minMinutes = DURATION_STEPS_MIN[0] ?? 1;
  const maxMinutes = DURATION_STEPS_MIN[DURATION_STEPS_MIN.length - 1] ?? shown;
  const spoken = t.minutes(shown);

  const pressStep = (delta: 1 | -1) => {
    if (swallowPress.current) return;
    const current = stepToDuration(index);
    const next = stepToDuration(index + delta);
    if (next === current) return;
    playSelectionTick();
    onChangeDuration(next);
  };

  return (
    <Animated.View style={[st.slider, s.trackBg]} testID={testID}>
      <GestureDetector gesture={pan}>
        <View
          style={st.sliderHit}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          aria-valuetext={spoken}
          aria-valuenow={shown}
          aria-valuemin={minMinutes}
          aria-valuemax={maxMinutes}
          accessibilityActions={[
            { name: 'increment', label: t.more },
            { name: 'decrement', label: t.less },
          ]}
          onAccessibilityAction={(e) => pressStep(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        >
          <View style={st.sliderRow}>
            <StepButton
              glyph="−"
              enabled={index > 0}
              onPress={() => pressStep(-1)}
              styles={s}
              fonts={fonts}
              testID={testID && `${testID}-menos`}
            />
            <Animated.Text style={[st.sliderValue, { fontFamily: fonts.light }, s.ink]} numberOfLines={1}>
              {shown}
              <Animated.Text style={[st.stepUnit, { fontFamily: fonts.medium }, s.inkSoft]}>
                {' '}
                min
              </Animated.Text>
            </Animated.Text>
            <StepButton
              glyph="+"
              enabled={index < DURATION_STEPS_MIN.length - 1}
              onPress={() => pressStep(1)}
              styles={s}
              fonts={fonts}
              testID={testID && `${testID}-mas`}
            />
          </View>
          <Animated.Text style={[st.sliderLabel, { fontFamily: fonts.medium }, s.inkSoft]}>
            {label}
          </Animated.Text>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

function StepButton({
  glyph,
  enabled,
  onPress,
  styles: s,
  fonts,
  testID,
}: {
  glyph: string;
  enabled: boolean;
  onPress: () => void;
  styles: MenuStyles;
  fonts: MenuFonts;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={9}
      style={({ pressed }) => [st.stepBtn, { opacity: !enabled ? 0.35 : pressed ? 0.6 : 1 }]}
      // El contenedor ya es el control accesible: estos botones no se anuncian.
      importantForAccessibility="no"
      accessibilityElementsHidden
      testID={testID}
    >
      <Animated.View style={[StyleSheet.absoluteFill, st.stepBtnBg, s.trackBg]} />
      <Animated.Text style={[st.stepGlyph, { fontFamily: fonts.regular }, s.inkSoft]}>{glyph}</Animated.Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  segTrack: { flexDirection: 'row', borderRadius: 14, padding: 3 },
  segItem: { flex: 1, height: 42 },
  segPill: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 14, letterSpacing: 0.1 },

  chip: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipBg: { borderRadius: 12 },
  chipText: { fontSize: 14, letterSpacing: 0.2, fontVariant: ['tabular-nums'] },
  chipRound: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  chipRoundBg: { borderRadius: 25 },
  chipRoundText: { fontSize: 17, fontVariant: ['tabular-nums'] },

  stepper: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 32 },
  stepBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  stepBtnBg: { borderRadius: 13 },
  stepGlyph: { fontSize: 16, lineHeight: 20 },
  stepValue: {
    fontSize: 23,
    lineHeight: 30,
    minWidth: 54,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stepUnit: { fontSize: 12 },
  stepLabel: { fontSize: 11.5, letterSpacing: 0.3, marginTop: 2 },

  // Barra a todo el ancho: − pegado a la izquierda, + a la derecha.
  slider: {
    marginTop: 10,
    borderRadius: 16,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  sliderHit: { minHeight: 44 },
  sliderRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  sliderValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 23,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  sliderLabel: { textAlign: 'center', fontSize: 11.5, letterSpacing: 0.3, marginTop: 2 },
});
