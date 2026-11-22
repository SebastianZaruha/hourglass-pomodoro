/**
 * Vidrio líquido.
 *
 * La hoja de ajustes NO lo pinta en el lienzo del reloj. En Android ese
 * lienzo es un TextureView y se compone por encima de las vistas que van
 * después: el frasco tapaba el menú y el vidrio tapaba su texto. `VidrioHoja`
 * vive dentro de la hoja (misma vista, mismo desplazamiento) y desenfoca una
 * foto del reloj.
 *
 * La ayuda, el consentimiento y la pausa de lado sí siguen en el lienzo
 * (`VidrioPantalla`): su texto es una vista de React Native con elevación,
 * por encima del lienzo.
 */
import {
  BackdropBlur,
  Blur,
  Canvas,
  Fill,
  Group,
  Image,
  Paint,
  Rect,
  RoundedRect,
  rect,
  rrect,
  type SkImage,
} from '@shopify/react-native-skia';
import { useLayoutEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { interpolateColor, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { CapturaReloj } from './capturaReloj';
import { VIDRIO } from './vidrioLiquido';

/** Radio de las esquinas superiores de la hoja. */
export const SHEET_RADIUS = 30;

/**
 * Fondo de la hoja: la foto del reloj, desplazada para que coincida con lo
 * que hay detrás, desenfocada y teñida. Se mueve con la hoja porque es hija
 * suya; `top` solo elige qué trozo de la foto se ve.
 */
export function VidrioHoja({
  width,
  height,
  screenHeight,
  top,
  themeProgress,
  captura,
}: {
  readonly width: number;
  readonly height: number;
  readonly screenHeight: number;
  /** Canto superior de la hoja en la pantalla (se anima con ella). */
  readonly top: SharedValue<number>;
  /** 0 = tema claro, 1 = oscuro. */
  readonly themeProgress: SharedValue<number>;
  readonly captura: CapturaReloj;
}) {
  const [imagen, setImagen] = useState<SkImage | null>(null);
  useLayoutEffect(() => {
    setImagen(captura.imagen);
    return captura.suscribir(() => setImagen(captura.imagen));
  }, [captura]);
  const y = useDerivedValue(() => -top.value);
  const tinte = useDerivedValue(() =>
    interpolateColor(themeProgress.value, [0, 1], [VIDRIO.tinteClaro, VIDRIO.tinteOscuro]),
  );
  // El radio de abajo cae fuera de la hoja: solo se redondea el canto de arriba.
  const clip = useDerivedValue(() =>
    rrect(rect(0, 0, width, height + SHEET_RADIUS), SHEET_RADIUS, SHEET_RADIUS),
  );
  const filo = useDerivedValue(() => rect(SHEET_RADIUS, 0, Math.max(0, width - SHEET_RADIUS * 2), 1));
  if (!imagen || width <= 0 || height <= 0) return null;
  return (
    <Canvas style={[StyleSheet.absoluteFill, styles.lienzo]} pointerEvents="none">
      <Group clip={clip}>
        <Group
          layer={
            <Paint>
              <Blur blur={VIDRIO.blur} mode="clamp" />
            </Paint>
          }
        >
          <Image image={imagen} x={0} y={y} width={width} height={screenHeight} fit="fill" />
        </Group>
        <Fill color={tinte} />
        <RoundedRect rect={clip} style="stroke" strokeWidth={1} color={VIDRIO.canto} />
        <Rect rect={filo} color={VIDRIO.cantoArriba} />
      </Group>
    </Canvas>
  );
}

/** El mismo vidrio, a pantalla completa, dentro del lienzo del reloj. */
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

const styles = StyleSheet.create({
  // Por debajo del contenido de la hoja (ese lleva elevación).
  lienzo: { zIndex: 0, elevation: 0 },
});
