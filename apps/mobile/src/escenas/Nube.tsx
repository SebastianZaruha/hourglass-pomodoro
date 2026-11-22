/**
 * Nube de Lluvia, en vídeo. No gira con el frasco: se pinta fuera de ese grupo.
 * Un solo reproductor no puede cruzar el final con el principio, así que en el
 * corte la opacidad baja y vuelve en unos 300 ms.
 */
import { Asset } from 'expo-asset';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { Group, Image, Paint, RuntimeShader, useImage, useVideo } from '@shopify/react-native-skia';

import { disposeLater } from '../hourglass/disposal';
import type { HourglassLayout } from '../hourglass/layout';
import { NUBE_SKSL } from '../hourglass/shaders/nube';
import { compileShader } from '../hourglass/shaders/uniforms';
import type { MotionSource } from '../hourglass/types';

const FORMA = 438 / 1100;

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
  const efecto = useMemo(() => compileShader('nube', NUBE_SKSL), []);
  useEffect(() => () => disposeLater([efecto]), [efecto]);

  const [uri, setUri] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    if (reducir) return;
    let vivo = true;
    Asset.fromModule(require('../../assets/nube/nube.mp4'))
      .downloadAsync()
      .then((asset) => {
        if (!vivo) return;
        const local = asset.localUri ?? asset.uri;
        if (local) setUri(local);
        else setFallo(true);
      })
      .catch(() => {
        if (vivo) setFallo(true);
      });
    return () => {
      vivo = false;
    };
  }, [reducir]);

  const opacidad = useSharedValue(opacidadDe(motion.gravity.x, motion.gravity.y));
  const enFondo = useSharedValue(AppState.currentState !== 'active');
  const corte = useSharedValue(1);
  const paused = useDerivedValue(() => enFondo.value || opacidad.value <= 0.001);
  const video = useVideo(reducir || fallo ? null : uri, { looping: true, volume: 0, paused });
  const [conMarco, setConMarco] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      enFondo.value = estado !== 'active';
    });
    return () => sub.remove();
  }, [enFondo]);

  useEffect(
    () =>
      motion.subscribe(() => {
        opacidad.value = opacidadDe(motion.gravity.x, motion.gravity.y);
      }),
    [motion, opacidad],
  );

  useAnimatedReaction(
    () => video.currentTime.value as number,
    (t, prev) => {
      if (prev != null && prev > 0.8 && t + 0.4 < prev) {
        corte.value = withTiming(0, { duration: 140 }, (fin) => {
          if (fin) corte.value = withTiming(1, { duration: 180 });
        });
      }
    },
  );
  useAnimatedReaction(
    () => video.currentFrame.value != null,
    (hay, antes) => {
      if (hay && !antes) runOnJS(setConMarco)(true);
    },
  );

  const visible = useDerivedValue(() => opacidad.value * corte.value);
  const uniforme = { uY: y, uH: alto, uOscuro: oscuro ? 1 : 0 };
  const foto = reducir || fallo || !uri || !conMarco;
  const imagen = foto ? poster : video.currentFrame;

  return (
    <Group
      opacity={visible}
      layer={
        <Paint>
          <RuntimeShader source={efecto} uniforms={uniforme} />
        </Paint>
      }
    >
      <Image image={imagen} x={x} y={y} width={ancho} height={alto} fit="fill" />
    </Group>
  );
}
