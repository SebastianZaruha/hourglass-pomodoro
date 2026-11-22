/**
 * Vidrio líquido.
 *
 * La hoja no lleva otro lienzo de Skia. En Android ese lienzo (TextureView)
 * se compone por encima de sus hermanos y se queda los toques: al abrir el
 * menú se veía el vidrio vacío, el texto no estaba, y el único gesto que
 * respondía era el «atrás» del sistema (el reloj ya tenía los gestos
 * apagados). `VidrioHoja` es una foto del reloj desenfocada fuera de pantalla
 * y pintada con una Image normal, debajo del texto. No recibe toques.
 *
 * La ayuda, el consentimiento y la pausa de lado sí siguen en el lienzo
 * (`VidrioPantalla`): su texto es una vista de React Native con elevación,
 * por encima del lienzo.
 */
import {
  BackdropBlur,
  Fill,
  Group,
  ImageFormat,
  Skia,
  TileMode,
  rect,
  type SkImage,
} from '@shopify/react-native-skia';
import { useLayoutEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { CapturaReloj } from './capturaReloj';
import { VIDRIO } from './vidrioLiquido';

/** Radio de las esquinas superiores de la hoja. */
export const SHEET_RADIUS = 30;

/**
 * Foto del reloj desenfocada y teñida, en JPEG. Se hace fuera del lienzo
 * para que el resultado sea una vista normal: queda debajo del texto y no
 * se come los toques. Si falla, null: la hoja sigue siendo opaca y usable.
 */
function fotoVidrio(imagen: SkImage, ancho: number, alto: number, progreso: number): string | null {
  const w = Math.max(1, Math.round(ancho));
  const h = Math.max(1, Math.round(alto));
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) return null;
  const filtro = Skia.ImageFilter.MakeBlur(VIDRIO.blur, VIDRIO.blur, TileMode.Clamp, null);
  const pintura = Skia.Paint();
  const velo = Skia.Paint();
  try {
    pintura.setImageFilter(filtro);
    const src = Skia.XYWHRect(0, 0, imagen.width(), imagen.height());
    const dst = Skia.XYWHRect(0, 0, w, h);
    const canvas = surface.getCanvas();
    canvas.drawImageRect(imagen, src, dst, pintura);
    velo.setColor(Skia.Color(interpolateColor(progreso, [0, 1], [VIDRIO.tinteClaro, VIDRIO.tinteOscuro])));
    canvas.drawRect(dst, velo);
    const salida = surface.makeImageSnapshot();
    try {
      const datos = salida.encodeToBase64(ImageFormat.JPEG, 70);
      return datos ? `data:image/jpeg;base64,${datos}` : null;
    } finally {
      salida.dispose();
    }
  } catch {
    return null;
  } finally {
    pintura.dispose();
    velo.dispose();
    filtro.dispose();
    surface.dispose();
  }
}

/**
 * Fondo de la hoja: la foto del reloj, desplazada para coincidir con lo que
 * hay detrás. Es hija de la hoja, así que se mueve con ella; `top` solo
 * elige qué trozo se ve. Debajo, un velo opaco por si la foto aún no está:
 * el texto nunca flota sobre el frasco.
 */
export function VidrioHoja({
  width,
  screenHeight,
  top,
  themeProgress,
  captura,
}: {
  readonly width: number;
  readonly screenHeight: number;
  /** Canto superior de la hoja en la pantalla (se anima con ella). */
  readonly top: SharedValue<number>;
  /** 0 = tema claro, 1 = oscuro. */
  readonly themeProgress: SharedValue<number>;
  readonly captura: CapturaReloj;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useLayoutEffect(() => {
    let vivo = true;
    const aplicar = () => {
      if (!vivo) return;
      const img = captura.imagen;
      if (!img || width < 1 || screenHeight < 1) {
        setUri(null);
        return;
      }
      setUri(fotoVidrio(img, width, screenHeight, themeProgress.get()));
    };
    aplicar();
    const baja = captura.suscribir(aplicar);
    return () => {
      vivo = false;
      baja();
    };
  }, [captura, width, screenHeight, themeProgress]);
  const desplazar = useAnimatedStyle(() => ({
    transform: [{ translateY: -top.value }],
  }));
  const velo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(themeProgress.value, [0, 1], [VIDRIO.tinteDialogoClaro, VIDRIO.tinteDialogoOscuro]),
  }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, velo]} />
      {uri ? (
        <Animated.View pointerEvents="none" style={[{ width, height: screenHeight }, desplazar]}>
          <Image source={{ uri }} style={{ width, height: screenHeight }} resizeMode="stretch" />
        </Animated.View>
      ) : null}
    </View>
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

