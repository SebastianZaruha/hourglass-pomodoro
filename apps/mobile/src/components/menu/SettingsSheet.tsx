/**
 * Hoja de ajustes (concepto A de la fase 3): sube desde abajo sobre el reloj
 * como un vidrio (sin desenfoque desde la 1.8.9). Aquí está la parte de
 * React Native (textos y controles, con fondo transparente); el vidrio lo
 * dibuja `FrostedPanel` en el lienzo de Skia, siguiendo el mismo `offset`.
 *
 * Se cierra:
 *   - arrastrando hacia abajo (gesto de Gesture Handler en el hilo de UI),
 *   - tocando fuera (el velo de TimerScreen),
 *   - con el botón «atrás» de Android (BackHandler; en la web, con Escape),
 *   - con el asa (botón accesible «Cerrar ajustes»).
 *
 * Si la pantalla es baja y el contenido no cabe, el cuerpo se desplaza
 * (ScrollView) y entonces solo se arrastra desde la cabecera.
 *
 * Disposición compacta (1.8.8, «B»): la hoja queda baja, cerca del pulgar.
 *   - Sesión como pestañas («Sesión única» / «Ciclos») que solo muestran lo
 *     de la pestaña elegida: los tiempos rápidos o el ciclo. La pestaña es
 *     el modo de sesión de los ajustes, así que al abrir sale siempre el
 *     último modo usado.
 *   - Al pie, UNA fila de botones redondos (QuickSettings): Tema e Idioma
 *     (rotan al tocarlos) │ Sonido, Vibración y Ventana flotante.
 *
 * Alto estable (1.8.8): ver `settleMeasure` / `sheetLayout` en el core. La
 * hoja ya no se re-mide a sí misma en bucle (el alto medido ↔ la posición
 * redondeada al píxel), que es lo que la hacía «vibrar» a su alto natural.
 */
import {
  CYCLE_LIMITS,
  CYCLE_PRESETS,
  LANGUAGE_CYCLE,
  THEME_CYCLE,
  activeCycleConfig,
  languageShort,
  languageSpoken,
  nextInCycle,
  settleMeasure,
  sheetLayout,
  stepMinutes,
  stepRounds,
  themeSpoken,
  type CycleConfig,
  type CyclePresetId,
  type Messages,
  type SessionMode,
  type Settings,
  snapToPixel,
} from '@reloj/core';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { AlertsNotice } from '../../background/useBackgroundTimer';
import { useT } from '../../i18n/I18n';
import { announce } from '../../hooks/useScreenReader';
import type { HourglassTheme } from '../../theme/theme';
import { Chip, Segmented, Stepper, type SegmentOption } from './controls';
import { QuickTooltip, RoundButton, themeIcon, useQuickTooltip } from './QuickSettings';
import { useMenuStyles, type MenuFonts } from './themedStyles';
import { SHEET_DENSITY, type SheetState } from './useSheet';

/** Tiempos rápidos (minutos). */
export const QUICK_TIMES_MIN = [5, 10, 15, 25, 45, 60] as const;

const modeOptions = (t: Messages): readonly SegmentOption<SessionMode>[] => [
  { value: 'single', label: t.single },
  { value: 'cycles', label: t.cycles },
];

/** Arrastre (fracción del alto) o velocidad (px/s) a partir de los que se cierra. */
const CLOSE_FRACTION = 0.22;
const CLOSE_VELOCITY = 700;
const MINUTE_MS = 60_000;

type SettingsPatch = Partial<Omit<Settings, 'version' | 'updatedAt'>>;

interface Props {
  readonly sheet: SheetState;
  readonly settings: Settings;
  readonly update: (patch: SettingsPatch) => void;
  readonly theme: HourglassTheme;
  readonly themeProgress: SharedValue<number>;
  readonly fonts: MenuFonts;
  readonly screenHeight: number;
  /** Márgenes seguros (muesca, barra de gestos). */
  readonly safeTop: number;
  readonly safeBottom: number;
  /** Abre la ayuda de gestos (botón «?» de la cabecera). */
  readonly onShowGestures: () => void;
  /** Falta un permiso de los avisos en segundo plano (1.7, Android): texto y arreglo. */
  readonly alertsNotice?: AlertsNotice | null;
  /** Interruptor «Ventana flotante» (1.8, solo Android con el módulo nativo). */
  readonly floating?: {
    readonly value: boolean;
    readonly onChange: (on: boolean) => void;
    readonly notice: AlertsNotice | null;
  } | null;
  /** ¿Está encendido el lector de pantalla? (para el aviso al abrir) */
  readonly screenReader?: boolean;
}

export function SettingsSheet({
  sheet,
  settings,
  update,
  theme,
  themeProgress,
  fonts,
  screenHeight,
  safeTop,
  safeBottom,
  onShowGestures,
  alertsNotice = null,
  floating = null,
  screenReader = false,
}: Props) {
  const t = useT();
  const s = useMenuStyles(themeProgress);
  const base = { styles: s, fonts, pillShadow: theme.ui.pillShadow };
  const { open, visible, hide, offset, height } = sheet;
  // Etiqueta de la pulsación larga en la fila de botones redondos (1.8.10).
  const { state: tipState, control: tip } = useQuickTooltip();
  const [quickRowWidth, setQuickRowWidth] = useState(0);
  const round = { ...base, progress: themeProgress, tip };
  // Con la hoja cerrándose, la etiqueta se va ya.
  useEffect(() => {
    if (!open) tip.hide();
  }, [open, tip]);

  // ─── Alto: el del contenido, sin pasar de casi toda la pantalla ─────────
  // Medidas con histéresis y alto al píxel (1.8.8, ver sheetHeight en el
  // core): un vaivén de un píxel en la medida ya no mueve la hoja.
  const maxHeight = screenHeight - safeTop - 56;
  const [headerH, setHeaderH] = useState(0);
  const [bodyH, setBodyH] = useState(0);
  const { height: sheetHeight, scrollable } = sheetLayout({
    header: headerH,
    body: bodyH,
    bottomPad: safeBottom + 14,
    maxHeight,
    density: SHEET_DENSITY,
  });
  // Antes de pintar (y no después): el vidrio (Skia) y la vista cambian de
  // alto en el mismo fotograma.
  useLayoutEffect(() => {
    if (sheetHeight > 0) {
      height.set(sheetHeight);
      // Escondida del todo, se queda justo por debajo del borde con el alto
      // nuevo. Ojo: comprobamos `visible` y no `open`; si no, al cerrar este
      // efecto cortaría la animación de salida (y la hoja «saltaría»).
      if (!visible) offset.set(sheetHeight + 40);
    }
  }, [sheetHeight, visible, height, offset]);

  // ─── Tema / Idioma: anunciar el valor nuevo ─────────────────────────────
  // Después del cambio (y no al tocar): el idioma nuevo ya está aplicado y
  // «Idioma: English» se dice en inglés.
  const spokenAfterChange = useRef<'theme' | 'language' | null>(null);
  useEffect(() => {
    const what = spokenAfterChange.current;
    if (!what) return;
    spokenAfterChange.current = null;
    announce(what === 'theme' ? themeSpoken(t, settings.theme) : languageSpoken(t, settings.language));
  }, [t, settings.theme, settings.language]);

  // ─── Atrás de Android ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    // Solo con el lector de pantalla encendido (1.8.3, ver `announce`).
    if (screenReader) announce(t.settings);
    if (Platform.OS === 'web') {
      // En la web no hay botón «atrás» del sistema: usamos la tecla Escape.
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') hide();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      hide();
      return true; // ya lo hemos gestionado: no salir de la app
    });
    return () => sub.remove();
    // Solo al abrir (no al cambiar de idioma con la hoja abierta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hide]);

  // ─── Arrastrar hacia abajo para cerrar ──────────────────────────────────
  const makePan = (enabled: boolean) => ({
    enabled: enabled && open,
    activeOffsetY: 8, // solo hacia abajo
    failOffsetX: [-24, 24] as [number, number],
    onUpdate: (e: { translationY: number }) => {
      'worklet';
      // Hacia arriba ofrece un poco de resistencia (efecto goma).
      const y = e.translationY;
      offset.value = y >= 0 ? y : -Math.sqrt(-y) * 2;
    },
    onDeactivate: (e: { translationY: number; velocityY: number }) => {
      'worklet';
      if (e.translationY > height.value * CLOSE_FRACTION || e.velocityY > CLOSE_VELOCITY) {
        scheduleOnRN(hide);
      } else {
        offset.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      }
    },
  });
  const headerPan = usePanGesture(makePan(true));
  const bodyPan = usePanGesture(makePan(!scrollable));

  // Al píxel físico, igual que el canto del vidrio (`top`, ver useSheet; 1.8.7).
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: snapToPixel(offset.value, SHEET_DENSITY) }],
  }));

  // ─── Valores mostrados ──────────────────────────────────────────────────
  const cycles = settings.sessionMode === 'cycles';
  const cycle = activeCycleConfig(settings);
  const lastMin = Math.round(settings.lastDurationMs / MINUTE_MS);
  const summary = cycles
    ? t.summaryCycles(cycle.workMin, cycle.breakMin, cycle.rounds)
    : t.summarySingle(formatMinutes(lastMin));

  /** Editar un valor de ciclo pasa a «Personalizado» partiendo de lo que se ve. */
  const editCycle = (patch: Partial<CycleConfig>) =>
    update({ sessionMode: 'cycles', cyclePreset: 'custom', customCycle: { ...cycle, ...patch } });

  return (
    <Animated.View
      style={[styles.sheet, { height: sheetHeight || undefined }, slide]}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityViewIsModal={open}
      importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!open}
      testID="hoja-ajustes"
    >
      <GestureDetector gesture={headerPan}>
        <View onLayout={settled(setHeaderH)} style={styles.header}>
          <Pressable
            onPress={hide}
            style={styles.grabArea}
            accessibilityRole="button"
            accessibilityLabel={t.closeSettings}
            testID="cerrar-ajustes"
          >
            <Animated.View style={[styles.grabber, s.grabberBg]} />
          </Pressable>
          {/* Título con el resumen debajo; a la derecha, el «?» de los gestos. */}
          <View style={styles.headRow}>
            <View style={styles.headText}>
              <Animated.Text
                style={[styles.title, { fontFamily: fonts.medium }, s.ink]}
                accessibilityRole="header"
                testID="titulo-ajustes"
              >
                {t.settings}
              </Animated.Text>
              <Animated.Text
                style={[styles.summary, { fontFamily: fonts.regular }, s.inkSoft]}
                numberOfLines={1}
              >
                {summary}
              </Animated.Text>
            </View>
            <Pressable
              onPress={onShowGestures}
              style={({ pressed }) => [styles.helpTouch, pressed && styles.helpPressed]}
              accessibilityRole="button"
              accessibilityLabel={t.showGestures}
              testID="boton-gestos"
            >
              <Animated.View style={[styles.helpRing, s.lineBorder]}>
                <Animated.Text style={[styles.helpGlyph, { fontFamily: fonts.medium }, s.inkSoft]}>
                  ?
                </Animated.Text>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </GestureDetector>

      <GestureDetector gesture={bodyPan}>
        <ScrollView
          scrollEnabled={scrollable}
          showsVerticalScrollIndicator={scrollable}
          bounces={false}
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: safeBottom + 14 }}
        >
          <View onLayout={settled(setBodyH)} style={styles.body}>
            {/* Sesión: pestañas que solo enseñan lo de la elegida (el último modo usado). */}
            <View style={styles.tabs}>
              <Segmented
                {...base}
                options={modeOptions(t)}
                value={settings.sessionMode}
                onChange={(sessionMode) => update({ sessionMode })}
                accessibilityLabel={t.sessionType}
                testID="pestana"
              />
            </View>

            {cycles ? (
              /* Ciclos: preajustes, Personalizado y trabajo / descanso / rondas. */
              <Section label={t.cycle} styles={s} fonts={fonts}>
                <View style={styles.presets} accessibilityRole="radiogroup" accessibilityLabel={t.cycle}>
                  {CYCLE_PRESETS.map((p) => (
                    <Chip
                      {...base}
                      key={p.id}
                      style={styles.preset}
                      label={`${p.config.workMin}/${p.config.breakMin}`}
                      selected={settings.cyclePreset === p.id}
                      accessibilityLabel={t.presetSpoken(p.config.workMin, p.config.breakMin)}
                      onPress={() => update({ sessionMode: 'cycles', cyclePreset: p.id })}
                      testID={`preajuste-${p.id}`}
                    />
                  ))}
                  <Chip
                    {...base}
                    style={styles.presetCustom}
                    label={t.custom}
                    selected={settings.cyclePreset === 'custom'}
                    accessibilityLabel={t.custom}
                    onPress={() => update({ sessionMode: 'cycles', cyclePreset: 'custom' as CyclePresetId })}
                    testID="preajuste-custom"
                  />
                </View>
                <Animated.View style={[styles.steppers, s.trackBg]}>
                  <Stepper
                    {...base}
                    label={t.work}
                    value={cycle.workMin}
                    unit="min"
                    spoken={t.minutes(cycle.workMin)}
                    canDecrement={cycle.workMin > CYCLE_LIMITS.minMinutes}
                    canIncrement={cycle.workMin < CYCLE_LIMITS.maxMinutes}
                    onStep={(d) => editCycle({ workMin: stepMinutes(cycle.workMin, d) })}
                    testID="paso-trabajo"
                  />
                  <Animated.View style={[styles.vline, s.lineBg]} />
                  <Stepper
                    {...base}
                    label={t.break}
                    value={cycle.breakMin}
                    unit="min"
                    spoken={t.minutes(cycle.breakMin)}
                    canDecrement={cycle.breakMin > CYCLE_LIMITS.minMinutes}
                    canIncrement={cycle.breakMin < CYCLE_LIMITS.maxMinutes}
                    onStep={(d) => editCycle({ breakMin: stepMinutes(cycle.breakMin, d) })}
                    testID="paso-descanso"
                  />
                  <Animated.View style={[styles.vline, s.lineBg]} />
                  <Stepper
                    {...base}
                    label={t.rounds}
                    value={cycle.rounds}
                    spoken={t.roundsCount(cycle.rounds)}
                    canDecrement={cycle.rounds > CYCLE_LIMITS.minRounds}
                    canIncrement={cycle.rounds < CYCLE_LIMITS.maxRounds}
                    onStep={(d) => editCycle({ rounds: stepRounds(cycle.rounds, d) })}
                    testID="paso-rondas"
                  />
                </Animated.View>
                <Animated.Text style={[styles.cycleSummary, { fontFamily: fonts.regular }, s.inkSoft]}>
                  {t.cycleSummary(cycle.workMin, cycle.breakMin, cycle.rounds)}
                </Animated.Text>
              </Section>
            ) : (
              /* Sesión única: tiempos rápidos. */
              <Section label={t.quickTimesMin} styles={s} fonts={fonts}>
                <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t.quickTimes}>
                  {QUICK_TIMES_MIN.map((min) => (
                    <Chip
                      {...base}
                      key={min}
                      round
                      label={String(min)}
                      selected={lastMin === min}
                      accessibilityLabel={t.minutes(min)}
                      onPress={() => update({ sessionMode: 'single', lastDurationMs: min * MINUTE_MS })}
                      testID={`rapido-${min}`}
                    />
                  ))}
                </View>
              </Section>
            )}

            {/* Ajustes rápidos: una fila de botones redondos. */}
            <Animated.View style={[styles.hline, s.lineBg]} />
            <View style={styles.quickRow} onLayout={(e) => setQuickRowWidth(e.nativeEvent.layout.width)}>
              <RoundButton
                {...round}
                icon={themeIcon(settings.theme)}
                onPress={() => {
                  spokenAfterChange.current = 'theme';
                  update({ theme: nextInCycle(THEME_CYCLE, settings.theme) });
                }}
                accessibilityLabel={themeSpoken(t, settings.theme)}
                accessibilityHint={t.tapToChange}
                tooltip={t.theme}
                testID="rotar-tema"
              />
              <RoundButton
                {...round}
                glyph={languageShort(t, settings.language)}
                onPress={() => {
                  spokenAfterChange.current = 'language';
                  update({ language: nextInCycle(LANGUAGE_CYCLE, settings.language) });
                }}
                accessibilityLabel={languageSpoken(t, settings.language)}
                accessibilityHint={t.tapToChange}
                tooltip={t.language}
                testID="rotar-idioma"
              />
              <Animated.View style={[styles.quickDivider, s.lineBg]} />
              <RoundButton
                {...round}
                icon={settings.sound ? 'soundOn' : 'soundOff'}
                value={settings.sound}
                onPress={() => update({ sound: !settings.sound })}
                accessibilityLabel={t.sound}
                tooltip={t.sound}
                testID="interruptor-sonido"
              />
              <RoundButton
                {...round}
                icon="vibration"
                value={settings.haptics}
                onPress={() => update({ haptics: !settings.haptics })}
                accessibilityLabel={t.vibration}
                tooltip={t.vibration}
                testID="interruptor-vibracion"
              />
              {/* Ventana flotante (Android): el reloj encima de otras apps al salir. */}
              {floating ? (
                <RoundButton
                  {...round}
                  icon="floating"
                  value={floating.value}
                  onPress={() => floating.onChange(!floating.value)}
                  accessibilityLabel={t.floatingWindow}
                  tooltip={t.floatingWindow}
                  testID="interruptor-flotante"
                />
              ) : null}
              {/* Al final: se dibuja encima de los botones y de lo de arriba. */}
              <QuickTooltip
                state={tipState}
                rowWidth={quickRowWidth}
                styles={s}
                fonts={fonts}
                progress={themeProgress}
                shadow={theme.ui.pillShadow}
              />
            </View>
            {/* Solo si falta un permiso: una línea discreta que lo arregla. */}
            {[alertsNotice, floating?.notice ?? null].map((notice, i) =>
              notice ? (
                <Pressable
                  key={i}
                  onPress={notice.onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.notice, pressed && styles.helpPressed]}
                  testID={i === 0 ? 'aviso-permisos' : 'aviso-flotante'}
                >
                  <Animated.Text style={[styles.noticeText, { fontFamily: fonts.medium }, s.inkSoft]}>
                    {notice.text}
                  </Animated.Text>
                </Pressable>
              ) : null,
            )}
          </View>
        </ScrollView>
      </GestureDetector>
    </Animated.View>
  );
}

function Section({
  label,
  children,
  styles: s,
  fonts,
}: {
  label: string;
  children: ReactNode;
  styles: ReturnType<typeof useMenuStyles>;
  fonts: MenuFonts;
}) {
  return (
    <View style={styles.section}>
      <Animated.Text
        style={[styles.label, { fontFamily: fonts.semibold }, s.label]}
        accessibilityRole="header"
      >
        {label.toUpperCase()}
      </Animated.Text>
      {children}
    </View>
  );
}

/** `onLayout` que guarda la medida de una parte de la hoja con histéresis (ver `settleMeasure`). */
function settled(set: (update: (previous: number) => number) => void) {
  return (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    set((previous) => settleMeasure(previous, measured));
  };
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  header: { paddingHorizontal: 26 },
  grabArea: { alignSelf: 'center', width: 88, height: 30, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 36, height: 4, borderRadius: 2 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 16,
  },
  headText: { flexShrink: 1 },
  title: { fontSize: 19, letterSpacing: 0.2 },
  summary: { fontSize: 12, marginTop: 3, letterSpacing: 0.2 },
  // «?» discreto: anillo fino de 28 px con 44 px de área táctil.
  helpTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  helpPressed: { opacity: 0.5 },
  helpRing: {
    opacity: 0.75,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpGlyph: { fontSize: 14, lineHeight: 18 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: 26 },
  section: { marginBottom: 22 },
  label: { fontSize: 10.5, letterSpacing: 1.8, marginBottom: 10 },
  tabs: { marginBottom: 18 },
  chips: { flexDirection: 'row', justifyContent: 'space-between' },
  presets: { flexDirection: 'row', gap: 6 },
  // Los preajustes se reparten el sitio que deja «Personalizado», que toma
  // solo el ancho de su texto (así nunca se corta, ni en móviles estrechos).
  preset: { flex: 1, paddingHorizontal: 0 },
  presetCustom: { flexGrow: 0, flexShrink: 0, paddingHorizontal: 12 },
  steppers: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  vline: { width: StyleSheet.hairlineWidth, marginVertical: 14 },
  cycleSummary: { fontSize: 12, textAlign: 'center', marginTop: 9, letterSpacing: 0.2 },
  hline: { height: StyleSheet.hairlineWidth },
  quickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 },
  quickDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  notice: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  noticeText: { fontSize: 12, textAlign: 'center', letterSpacing: 0.2, textDecorationLine: 'underline' },
});
