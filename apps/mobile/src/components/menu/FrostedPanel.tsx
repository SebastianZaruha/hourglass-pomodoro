/**
 * Vidrio de la hoja de ajustes, dibujado con SKIA dentro del mismo lienzo
 * que el reloj (se pasa como `children` de <Hourglass>). La parte de React
 * Native de la hoja (textos y botones) va encima, con fondo transparente, y
 * se mueve con el MISMO shared value (`top`), así que vidrio y contenido
 * nunca se separan.
 *
 * Capas:
 *   1. Velo muy suave sobre toda la pantalla (aparece al abrir).
 *   2. Sombra difusa encima del canto de la hoja.
 *   3. Panel del color del tema, casi opaco, con un degradado suave.
 *   4. Brillo de 1 px en el canto superior (como el canto de un vidrio).
 *
 * El esmerilado no es un `BackdropBlur` de cada fotograma (eso se midió
 * lento en el A55, 1.8.9). Es una foto de la escena desenfocada una sola
 * vez (`sceneBlur`) y recortada con la forma de la hoja. Encima, un tinte
 * ahumado, un filo de luz y la sombra. Si la foto aún no está, queda el
 * degradado.
 *
 * Coste: montado siempre (1.8.6). Cerrada, la forma queda por debajo de la
 * pantalla: el recorte está vacío y el velo y la sombra tienen opacidad 0
 * (no se dibujan). Abrir y cerrar solo cambian shared values, en el hilo de
 * la interfaz, en el mismo fotograma que la hoja.
 *
 * Fundido (1.8.4): el vidrio sigue a la hoja (`glassFade` del core): suben
 * la opacidad del panel, la sombra y el filo.
 */
import {
  Fill,
  Group,
  Image,
  LinearGradient,
  Rect,
  RoundedRect,
  rect,
  rrect,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { glassFade } from '@reloj/core';
import { interpolateColor, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { DARK_THEME, LIGHT_THEME } from '../../theme/theme';

/** Radio de las esquinas superiores de la hoja. */
export const SHEET_RADIUS = 36;
/** Tinte ahumado: deja ver el fondo desenfocado. */
const PANEL_LIGHT = ['rgba(255, 252, 247, 0.38)', 'rgba(236, 228, 216, 0.52)'] as const;
const PANEL_DARK = ['rgba(36, 30, 26, 0.42)', 'rgba(18, 14, 12, 0.58)'] as const;
/** Alto de la sombra sobre el canto. */
const SHADOW_H = 28;

const L = LIGHT_THEME.ui;
const D = DARK_THEME.ui;

interface Props {
  readonly width: number;
  readonly height: number;
  /** Coordenada Y del canto superior de la hoja (se anima). */
  readonly top: SharedValue<number>;
  /** 0 = cerrada, 1 = abierta (para el velo). */
  readonly openness: SharedValue<number>;
  /** 0 = tema claro, 1 = oscuro (animado). */
  readonly themeProgress: SharedValue<number>;
  /** Escena ya desenfocada. Se dibuja una vez por fotograma, sin volver a desenfocar. */
  readonly frost?: SkImage | null;
  /** Dónde cae esa foto en la pantalla (el mismo recorte que el fondo). */
  readonly frostFrame?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null;
}

export function FrostedPanel({ width, height, top, openness, themeProgress, frost, frostFrame }: Props) {
  // La forma se prolonga por debajo de la pantalla para que las esquinas
  // redondeadas de abajo nunca se vean.
  const shape = useDerivedValue(() =>
    rrect(rect(0, top.value, width, height - top.value + SHEET_RADIUS), SHEET_RADIUS, SHEET_RADIUS),
  );
  const edgeBand = useDerivedValue(() => rect(0, top.value, width, SHEET_RADIUS));
  const highlight = useDerivedValue(() => rect(22, top.value + 1, Math.max(0, width - 44), 1));
  const shadowRect = useDerivedValue(() => rect(0, top.value - SHADOW_H, width, SHADOW_H + SHEET_RADIUS));
  const shadowStart = useDerivedValue(() => vec(0, top.value - SHADOW_H));
  const shadowEnd = useDerivedValue(() => vec(0, top.value + 4));

  // Intensidad del vidrio (0..1), según la hoja.
  const fade = useDerivedValue(() => glassFade(openness.value));
  const edge = useDerivedValue(() =>
    interpolateColor(themeProgress.value, [0, 1], [L.panelEdge, D.panelEdge]),
  );
  const scrim = useDerivedValue(() => interpolateColor(themeProgress.value, [0, 1], [L.scrim, D.scrim]));
  const panelStart = useDerivedValue(() => vec(0, top.value));
  const panelEnd = useDerivedValue(() => vec(0, height));
  const panelColors = useDerivedValue(() => [
    interpolateColor(themeProgress.value, [0, 1], [PANEL_LIGHT[0], PANEL_DARK[0]]),
    interpolateColor(themeProgress.value, [0, 1], [PANEL_LIGHT[1], PANEL_DARK[1]]),
  ]);
  const shadowColors = useDerivedValue(() => [
    'rgba(60, 44, 30, 0)',
    interpolateColor(themeProgress.value, [0, 1], ['rgba(60, 44, 30, 0.07)', 'rgba(0, 0, 0, 0.28)']),
  ]);

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color={scrim} opacity={openness} />
      <Rect rect={shadowRect} opacity={fade}>
        <LinearGradient start={shadowStart} end={shadowEnd} colors={shadowColors} />
      </Rect>
      <Group clip={shape}>
        {frost && frostFrame ? (
          <Image
            image={frost}
            x={frostFrame.x}
            y={frostFrame.y}
            width={frostFrame.w}
            height={frostFrame.h}
            fit="fill"
            opacity={fade}
          />
        ) : null}
        <Fill opacity={fade}>
          <LinearGradient start={panelStart} end={panelEnd} colors={panelColors} />
        </Fill>
      </Group>
      <Rect rect={highlight} color="rgba(255, 252, 246, 0.9)" opacity={fade} />
      <Group clip={edgeBand}>
        <RoundedRect rect={shape} style="stroke" strokeWidth={1} color={edge} opacity={fade} />
      </Group>
    </Group>
  );
}
