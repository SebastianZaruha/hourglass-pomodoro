/**
 * Nube de Lluvia. El vídeo de Skia en Android release cierra la app
 * (el decodificador devuelve un buffer ya liberado), así que aquí va
 * el póster, con el mismo tratamiento y un vaivén muy corto.
 * Si el efecto no compila, se pinta el póster tal cual: no se cierra.
 */
import { useEffect, useMemo } from 'react';
import { useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Group, Image, Paint, RuntimeShader, Skia, useImage } from '@shopify/react-native-skia';

import { disposeLater } from '../hourglass/disposal';
import type { HourglassLayout } from '../hourglass/layout';
import { NUBE_SKSL } from '../hourglass/shaders/nube';
import type { MotionSource } from '../hourglass/types';

const FORMA = 438 / 1100;
/** Un vaivén de opacidad, en ms. No mueve la nube: la máscara va en coordenadas fijas. */
const DERIVA_MS = 6400;

/** 1 de pie o boca abajo, 0 a los 50°. Igual que el frasco de la web. */
function opacidadDe(gx: number, gy: number): number {
  let grados = (Math.abs(Math.atan2(gx, gy)) * 180) / Math.PI;
  grados = Math.min(grados, Math.abs(grados - 180), Math.abs(grados - 360));
  return Math.max(0, 1 - grados / 50);
}

export function NubeMovil({
  layout,
  motion,
  oscuro,
  reducir,
}: {
  readonly layout: HourglassLayout;
  readonly motion: MotionSource;
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

  const opacidad = useSharedValue(opacidadDe(motion.gravity.x, motion.gravity.y));
  const deriva = useSharedValue(0);
  useEffect(() => {
    if (reducir) {
      deriva.value = 0;
      return;
    }
    deriva.value = withRepeat(withTiming(1, { duration: DERIVA_MS }), -1, true);
  }, [reducir, deriva]);

  useEffect(
    () =>
      motion.subscribe(() => {
        opacidad.value = opacidadDe(motion.gravity.x, motion.gravity.y);
      }),
    [motion, opacidad],
  );

  const visible = useDerivedValue(() => opacidad.value * (0.9 + deriva.value * 0.1));
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
