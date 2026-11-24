/**
 * Nube de Lluvia, sobre la boca de arriba. Va con el volteo del móvil
 * (así sigue en la boca) y no con el giro de fase. El vídeo de Skia en
 * Android cierra la app, así que es el póster. Si el efecto no compila,
 * se pinta el póster tal cual.
 */
import { useEffect, useMemo } from 'react';
import { useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Group, Image, Paint, RuntimeShader, Skia, useImage } from '@shopify/react-native-skia';

import { disposeLater } from '../hourglass/disposal';
import type { HourglassLayout } from '../hourglass/layout';
import { NUBE_SKSL } from '../hourglass/shaders/nube';

const FORMA = 438 / 1100;
/** Un vaivén de opacidad, en ms. No mueve la nube: la máscara va en coordenadas fijas. */
const DERIVA_MS = 6400;

export function NubeMovil({
  layout,
  oscuro,
  reducir,
}: {
  readonly layout: HourglassLayout;
  readonly oscuro: boolean;
  readonly reducir: boolean;
}) {
  const ancho = layout.halfW * 2 * 1.5;
  const alto = ancho * FORMA;
  const x = layout.cx - ancho / 2;
  const y = layout.cy - layout.halfH - 0.28 * alto;
  const poster = useImage(require('../../assets/nube/nube.webp'));
  // Frontera nativa: Make devuelve null si el SkSL no compila. No se lanza.
  const efecto = useMemo(() => Skia.RuntimeEffect.Make(NUBE_SKSL), []);
  useEffect(() => () => disposeLater([efecto]), [efecto]);

  const deriva = useSharedValue(0);
  useEffect(() => {
    if (reducir) {
      deriva.value = 0;
      return;
    }
    deriva.value = withRepeat(withTiming(1, { duration: DERIVA_MS }), -1, true);
  }, [reducir, deriva]);

  // Sigue visible en cualquier inclinación. El frasco no se tumba con el
  // móvil: la boca de arriba sigue arriba en pantalla, y la nube se queda ahí.
  // La opacidad va a saltos de 1/255. El mismo número no reescribe el shared
  // value, así que el lienzo no se redibuja en cada fotograma del vaivén.
  const visible = useDerivedValue(() => Math.round((0.9 + deriva.value * 0.1) * 255) / 255);
  const uniforme = { uY: y, uH: alto, uOscuro: oscuro ? 1 : 0 };

  if (!poster) return null;

  return (
    <Group opacity={visible}>
      <Group
        layer={
          efecto ? (
            <Paint>
              <RuntimeShader source={efecto} uniforms={uniforme} />
            </Paint>
          ) : undefined
        }
      >
        <Image image={poster} x={x} y={y} width={ancho} height={alto} fit="fill" />
      </Group>
    </Group>
  );
}
