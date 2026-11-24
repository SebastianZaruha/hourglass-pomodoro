/**
 * Vidrio líquido de la hoja de ajustes, dentro del mismo lienzo que el reloj.
 * La hoja de React Native va encima, transparente, y comparte `top`.
 *
 * Detrás del panel, BackdropBlur del reloj (σ en vidrioLiquido.ts), un tinte
 * y un canto gris. Sin sombra y sin filo blanco. Cerrada, la forma queda
 * bajo la pantalla y el desenfoque no cubre nada.
 */
import { BackdropBlur, Fill, Group, Rect, RoundedRect, rect, rrect } from '@shopify/react-native-skia';
import { glassFade } from '@reloj/core';
import { interpolateColor, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { TIME_LINE_HEIGHT } from '../TimeDisplay';
import { VIDRIO } from './vidrioLiquido';

/** Radio de las esquinas superiores de la hoja. */
export const SHEET_RADIUS = 30;

interface Props {
  readonly width: number;
  readonly height: number;
  /** Coordenada Y del canto superior de la hoja (se anima). */
  readonly top: SharedValue<number>;
  /** 0 = cerrada, 1 = abierta. */
  readonly openness: SharedValue<number>;
  /** 0 = tema claro, 1 = oscuro (animado). */
  readonly themeProgress: SharedValue<number>;
}

export function FrostedPanel({ width, height, top, openness, themeProgress }: Props) {
  const shape = useDerivedValue(() =>
    rrect(rect(0, top.value, width, height - top.value + SHEET_RADIUS), SHEET_RADIUS, SHEET_RADIUS),
  );
  const filo = useDerivedValue(() => rect(SHEET_RADIUS, top.value, Math.max(0, width - SHEET_RADIUS * 2), 1));
  const fade = useDerivedValue(() => glassFade(openness.value));
  const tinte = useDerivedValue(() =>
    interpolateColor(themeProgress.value, [0, 1], [VIDRIO.tinteClaro, VIDRIO.tinteOscuro]),
  );

  return (
    <Group opacity={fade} clip={shape}>
      <BackdropBlur blur={VIDRIO.blur}>
        <Fill color={tinte} />
      </BackdropBlur>
      <RoundedRect rect={shape} style="stroke" strokeWidth={1} color={VIDRIO.canto} />
      <Rect rect={filo} color={VIDRIO.cantoArriba} />
    </Group>
  );
}

/** El mismo vidrio, a pantalla completa. `intenso` tapa lo que haya detrás. */
export function VidrioPantalla({
  width,
  height,
  opacity,
  themeProgress,
  intenso = false,
}: {
  readonly width: number;
  readonly height: number;
  readonly opacity: SharedValue<number>;
  readonly themeProgress: SharedValue<number>;
  readonly intenso?: boolean;
}) {
  const claro = intenso ? VIDRIO.tinteDialogoClaro : VIDRIO.tinteClaro;
  const oscuro = intenso ? VIDRIO.tinteDialogoOscuro : VIDRIO.tinteOscuro;
  const tinte = useDerivedValue(() => interpolateColor(themeProgress.value, [0, 1], [claro, oscuro]));
  const recorte = useDerivedValue(() => rect(0, 0, width, opacity.value < 0.001 ? 0 : height));

  return (
    <Group opacity={opacity} clip={recorte}>
      <BackdropBlur blur={intenso ? VIDRIO.blurDialogo : VIDRIO.blur}>
        <Fill color={tinte} />
      </BackdropBlur>
    </Group>
  );
}

/**
 * Pastilla de vidrio detrás de los dígitos. Vive en el lienzo del reloj:
 * BackdropBlur solo desenfoca ese lienzo. No recibe toques.
 */
export function VidrioReloj({
  width,
  height,
  bottom,
  opacity,
  themeProgress,
}: {
  readonly width: number;
  readonly height: number;
  /** El mismo `bottom` que TimeDisplay, en px desde el borde inferior del lienzo. */
  readonly bottom: number;
  readonly opacity: SharedValue<number>;
  readonly themeProgress: SharedValue<number>;
}) {
  const tinte = useDerivedValue(() =>
    interpolateColor(themeProgress.value, [0, 1], [VIDRIO.tinteClaro, VIDRIO.tinteOscuro]),
  );
  const forma = useDerivedValue(() => {
    const { ancho, paddingArriba, paddingAbajo, radio } = VIDRIO.reloj;
    const alto = paddingArriba + TIME_LINE_HEIGHT + paddingAbajo;
    const y = height - bottom - TIME_LINE_HEIGHT - paddingArriba;
    const x = (width - ancho) / 2;
    if (opacity.value < 0.001) return rrect(rect(0, 0, 0, 0), 0, 0);
    return rrect(rect(x, y, ancho, alto), radio, radio);
  });

  return (
    <Group opacity={opacity} clip={forma}>
      <BackdropBlur blur={VIDRIO.blur}>
        <Fill color={tinte} />
      </BackdropBlur>
      <RoundedRect rect={forma} style="stroke" strokeWidth={1} color={VIDRIO.canto} />
    </Group>
  );
}
