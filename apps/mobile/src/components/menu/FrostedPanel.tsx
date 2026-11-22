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

/** El mismo vidrio, a pantalla completa: ayuda, consentimiento y avisos. */
export function VidrioPantalla({
  width,
  height,
  opacity,
  themeProgress,
}: {
  readonly width: number;
  readonly height: number;
  readonly opacity: SharedValue<number>;
  readonly themeProgress: SharedValue<number>;
}) {
  const tinte = useDerivedValue(() =>
    interpolateColor(themeProgress.value, [0, 1], [VIDRIO.tinteClaro, VIDRIO.tinteOscuro]),
  );
  const recorte = useDerivedValue(() => rect(0, 0, width, opacity.value < 0.001 ? 0 : height));

  return (
    <Group opacity={opacity} clip={recorte}>
      <BackdropBlur blur={VIDRIO.blur}>
        <Fill color={tinte} />
      </BackdropBlur>
    </Group>
  );
}
