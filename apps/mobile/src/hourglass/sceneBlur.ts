/**
 * Foto desenfocada del fondo, hecha una vez.
 *
 * El menú la recorta con la forma de la hoja. No es un BackdropBlur de cada
 * fotograma: eso se midió lento en el A55 (1.8.9). Aquí el desenfoque ocurre
 * al cargar la escena, y la hoja solo la dibuja.
 */
import type { MaterialId } from '@reloj/core';
import { Skia, TileMode, useImage, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';

import { PLATES } from './plates';

function blurScene(source: SkImage): SkImage | null {
  const w = Math.max(1, Math.round(source.width() / 4));
  const h = Math.max(1, Math.round(source.height() / 4));
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) return null;
  const filter = Skia.ImageFilter.MakeBlur(10, 10, TileMode.Clamp, null);
  const paint = Skia.Paint();
  paint.setImageFilter(filter);
  surface
    .getCanvas()
    .drawImageRect(
      source,
      Skia.XYWHRect(0, 0, source.width(), source.height()),
      Skia.XYWHRect(0, 0, w, h),
      paint,
    );
  const snap = surface.makeImageSnapshot();
  surface.dispose();
  paint.dispose();
  filter.dispose();
  return snap;
}

export function useCachedSceneBlur(id: MaterialId): SkImage | null {
  const source = useImage(PLATES[id].scene);
  const blurred = useMemo(() => (source ? blurScene(source) : null), [source]);
  useEffect(() => () => blurred?.dispose(), [blurred]);
  return blurred;
}
