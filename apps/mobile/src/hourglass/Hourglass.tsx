/**
 * <Hourglass />: el reloj de arena completo dibujado con Skia.
 *
 * Es un componente REUTILIZABLE: no sabe de gestos, ajustes ni pantallas.
 * Recibe el tamaño, el tema, el estado del temporizador y una fuente de
 * movimiento (gravedad e inclinación, en vivo). Por eso podrá usarse tal cual
 * en la versión de escritorio (Skia funciona en web con CanvasKit).
 *
 * Capas (de atrás hacia delante), SkPictures en shared values:
 *   1. Fondo                                 (se regraba si cambia la luz)
 *   2. Sombra sobre la mesa                  (ídem; se desvanece al «levantar» el reloj)
 *   3. Cuerpo del vidrio                     (ídem)
 *   4. Arena + chorro                        (dinámica, cada fotograma)
 *   5. Reflejos y contorno del vidrio        (se regraba si cambia la luz)
 *
 * Grupos (1.5):
 *   [giro 180° del móvil volteado]
 *     fondo
 *     [desenfoque de la pausa, solo en la franja del reloj (1.8.1)]
 *       sombra · [EL RELOJ: cuerpo + arena + reflejos]
 *     `children` (vidrio de la ayuda y del consentimiento)
 *   [fundido del cambio de tema]
 *   [vidrio de la pausa de lado, a pantalla completa]
 *
 * EL RELOJ (capas 3-5) tiene su propia transformación, alrededor de su
 * centro: la `pose` (introducción: giro, escala, posición y opacidad) más el
 * giro de cambio de fase (`spin`, lo anima useSandEngine). Mientras gira se
 * «levanta» un poco (se encoge un 5 %) y su sombra se desvanece.
 *
 * Gestión de memoria: TODOS los objetos Skia (shaders compilados, paths,
 * pictures, paints del pintor) pertenecen a esta instancia. Cuando se
 * sustituyen (cambio de tamaño/tema) o el componente se desmonta, se liberan
 * con un pequeño retraso (ver disposal.ts). Nada vive a nivel de módulo.
 */
import { type ContentDefinition, type HourglassModel, type TimerStatus } from '@reloj/core';
import { Blur, Canvas, Group, Image, Paint, Picture, rect, useCanvasRef, type SkImage } from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { CapturaReloj } from '../components/menu/capturaReloj';
import { VidrioPantalla } from '../components/menu/FrostedPanel';
import { NubeMovil } from '../escenas/Nube';
import { useFondoImagen } from '../escenas/fondoImagen';
import type { FondoMovil, Material } from '../escenas';
import type { HourglassTheme } from '../theme/theme';
import { crearAgua } from './contenido/agua';
import { crearArena } from './contenido/arena';
import { disposeLater } from './disposal';
import { objectPose } from './objectPose';
import { computeLayout, isUsableSize, type LayoutInsets } from './layout';
import { createShaderSet, shaderSetDisposables } from './resources';
import { GlassPainter } from './staticLayers';
import { STILL_MOTION, type HourglassSnapshot, type MotionSource } from './types';
import { useSandEngine } from './useSandEngine';
import { useThemeCrossfade } from './useThemeCrossfade';

/**
 * Pose del reloj (la usa la introducción). Todos son shared values para
 * animarlos en el hilo de UI sin re-renderizar React.
 */
export interface HourglassPose {
  /** Giro en radianes. */
  readonly rotate: SharedValue<number>;
  /** Escala (1 = tamaño normal). */
  readonly scale: SharedValue<number>;
  /** 0 = en su sitio; 1 = centrado en la pantalla. */
  readonly centered: SharedValue<number>;
  /** Opacidad del reloj. */
  readonly opacity: SharedValue<number>;
  /** Opacidad de la sombra (0 = reloj «en el aire»). */
  readonly shadow: SharedValue<number>;
}

/**
 * Desenfoque del reloj en pausa:
 *  - 'full' (9 px): pausa por tumbar el móvil; el reloj «se aparta».
 *  - 'soft' (2,5 px): pausa con el dedo; se nota la pausa pero el reloj y su
 *    arena se siguen viendo bien (la persona puede querer mirar cuánto queda).
 */
export type PauseBlur = 'none' | 'soft' | 'full';
const PAUSE_BLUR_PX: Record<PauseBlur, number> = { none: 0, soft: 2.5, full: 9 };
/** Margen alrededor del reloj para que el desenfoque más fuerte no se corte (≈ 4σ). */
const BLUR_MARGIN = 40;

export interface HourglassProps {
  readonly width: number;
  readonly height: number;
  /** Espacio reservado arriba y abajo (barra de estado, texto del tiempo...). */
  readonly insets: LayoutInsets;
  readonly model: HourglassModel;
  readonly content: ContentDefinition;
  readonly theme: HourglassTheme;
  /** Fondo de la escena. Sin él, el degradado de Clásico. */
  readonly fondo?: FondoMovil;
  /** Arena en F1. El agua llega en F3. */
  readonly material?: Material;
  /** Luz de los granos, en grados. Sin ella, la luz de siempre. */
  readonly luzGrano?: number;
  /** Nube de vídeo sobre la boca. Solo Lluvia. */
  readonly nube?: boolean;
  readonly getSnapshot: () => HourglassSnapshot;
  readonly status: TimerStatus;
  readonly durationMs: number;
  /** Gravedad e inclinación en vivo (acelerómetro). Por defecto, quieto y de pie. */
  readonly motion?: MotionSource;
  /** Desenfoque de pausa (ver `PauseBlur`). */
  readonly pauseBlur?: PauseBlur;
  /**
   * Pausa al tumbar el móvil: un vidrio a pantalla completa (las mismas
   * constantes del menú) tapa fondo, frasco, nube y lo que haya en el lienzo.
   * El texto «Pausa» vive fuera del lienzo y se queda nítido.
   */
  readonly vidrioPausa?: boolean;
  /** 0 = tema claro, 1 = oscuro. Tiñe el vidrio de la pausa. */
  readonly themeProgress?: SharedValue<number>;
  readonly reduceMotion?: boolean;
  /** Pose animada del reloj (introducción). Sin ella, quieto en su sitio. */
  readonly pose?: HourglassPose;
  /** true mientras la pose se está animando (activa las capas de opacidad). */
  readonly poseActive?: boolean;
  /**
   * Elementos Skia que se dibujan encima del reloj, en el mismo lienzo (el
   * vidrio de la ayuda y del consentimiento). Giran con el móvil volteado,
   * pero no se desenfocan en la pausa. El vidrio del menú no va aquí: en
   * Android el lienzo tapa la hoja.
   */
  readonly children?: ReactNode;
  /**
   * Cuánto tapa el menú (0..1, shared value; 1.8.6). En pausa, el desenfoque
   * del reloj crece con él hasta el de la pausa de lado: detrás del menú el
   * reloj nunca se ve nítido, y sin re-renderizar nada (ver `blurNow`).
   */
  readonly menuOpenness?: SharedValue<number>;
  /**
   * Foto del lienzo para el vidrio del menú, que vive en la hoja. Mientras
   * `capturar` es true se renueva. Sin ellos, el reloj no hace fotos.
   */
  readonly captura?: CapturaReloj;
  readonly capturar?: boolean;
}

function HourglassComponent(props: HourglassProps) {
  // Con un tamaño inválido (0, NaN...) no hay nada que dibujar: así nunca
  // llegan a Skia coordenadas imposibles (p. ej. durante un redimensionado).
  if (!isUsableSize(props.width, props.height)) {
    return <View style={{ width: Math.max(0, props.width || 0), height: Math.max(0, props.height || 0) }} />;
  }
  return <HourglassCanvas {...props} />;
}

function HourglassCanvas({
  width,
  height,
  insets,
  model,
  content,
  theme,
  fondo = { tipo: 'procedural' },
  material = 'arena',
  luzGrano,
  nube = false,
  getSnapshot,
  status,
  durationMs,
  motion = STILL_MOTION,
  pauseBlur = 'none',
  vidrioPausa = false,
  themeProgress,
  reduceMotion = false,
  pose,
  poseActive = false,
  children,
  menuOpenness,
  captura,
  capturar = false,
}: HourglassProps) {
  // Si el bucle de dibujo falla (fuera del render), lo relanzamos DENTRO del
  // render para que lo capture el error boundary que nos envuelve.
  const [loopError, setLoopError] = useState<unknown>(null);
  if (loopError !== null) throw loopError;
  const onError = useCallback((error: unknown) => setLoopError(() => error), []);
  // ¿Está dando la vuelta por un cambio de fase? (lo avisa el bucle de dibujo)
  const [turning, setTurning] = useState(false);

  // Shaders compilados: uno por instancia, liberados al desmontar.
  const shaders = useMemo(() => createShaderSet(), []);
  useEffect(() => () => disposeLater(shaderSetDisposables(shaders)), [shaders]);

  const layout = useMemo(() => computeLayout(width, height, model, insets), [width, height, model, insets]);
  useEffect(() => () => disposeLater([layout.outerPath, layout.innerPath]), [layout]);

  const fuente = fondo.tipo === 'foto' ? fondo.fuente : null;
  const cargada = useFondoImagen(fuente);
  // La foto llega un instante después. Hasta entonces el frasco y el fondo
  // siguen los de antes, y cambian juntos: el fundido los cruza a la vez,
  // también con el menú abierto.
  const pendiente = fondo.tipo === 'foto' && cargada.fuente !== fuente;
  const mostrado = useRef({
    theme,
    fondo,
    foto: null as typeof cargada.imagen,
    material,
    nube,
    luz: luzGrano ?? null,
  });
  if (!pendiente) {
    mostrado.current = {
      theme,
      fondo,
      foto: fondo.tipo === 'foto' ? cargada.imagen : null,
      material,
      nube,
      luz: luzGrano ?? null,
    };
  }
  const temaPintado = mostrado.current.theme;
  const fondoPintado = mostrado.current.fondo;
  const foto = mostrado.current.foto;
  const materialPintado = mostrado.current.material;
  const nubePintada = mostrado.current.nube;
  const luzPintada = mostrado.current.luz;
  const anclaY = fondoPintado.tipo === 'foto' ? fondoPintado.anclaY : 1;

  // La arena no se recrea al cambiar el tema: solo el pintor.
  // El agua es otro contenido. Cambiar de escena no reinicia la otra.
  const arena = useMemo(() => crearArena({ model, cols: layout.cols, content }), [model, layout.cols, content]);
  const agua = useMemo(
    () => (materialPintado === 'agua' ? crearAgua({ model, layout }) : null),
    [materialPintado, model, layout],
  );
  const contenido = agua ?? arena;
  useEffect(() => () => arena.destruir(), [arena]);
  useEffect(() => () => agua?.destruir(), [agua]);

  // Pintor del vidrio (fondo, sombra, reflejos): objetos persistentes.
  const revisionPintor = useMemo(() => {
    const fotoPintor = foto && fondoPintado.tipo === 'foto' ? foto : null;
    arena.ponerPintor({
      layout,
      model,
      theme: temaPintado,
      content,
      shaders,
      luzGrano: luzPintada,
      foto: null,
      anclaY,
    });
    agua?.ponerPintor({
      layout,
      model,
      theme: temaPintado,
      content,
      shaders,
      luzGrano: null,
      foto: fotoPintor,
      anclaY,
    });
    return arena.revision + (agua?.revision ?? 0);
  }, [arena, agua, layout, model, temaPintado, content, shaders, luzPintada, foto, anclaY, fondoPintado.tipo]);
  const glass = useMemo(
    () =>
      new GlassPainter(
        shaders,
        layout,
        model,
        temaPintado,
        foto && fondoPintado.tipo === 'foto' ? { image: foto, anclaY } : null,
      ),
    [shaders, layout, model, temaPintado, foto, fondoPintado, anclaY],
  );
  useEffect(() => () => disposeLater([glass]), [glass]);

  const { background, shadow, body, sand, front, rotation, spin } = useSandEngine({
    contenido,
    revisionPintor,
    glass,
    motion,
    getSnapshot,
    status,
    durationMs,
    reduceMotion,
    onError,
    onTurnChange: setTurning,
  });

  // Giro de 180° al voltear, alrededor del centro de la pantalla.
  const transform = useDerivedValue(() => [{ rotate: rotation.value }]);
  const origin = useMemo(() => ({ x: width / 2, y: height / 2 }), [width, height]);

  // Transformación del RELOJ alrededor de su propio centro (el cuello).
  const center = useMemo(() => ({ x: layout.cx, y: layout.cy }), [layout]);
  /** Distancia del centro del reloj al de la pantalla (la intro empieza centrada). */
  const toScreenCenter = height / 2 - layout.cy;
  const objW = 2 * layout.halfW;
  const objH = 2 * layout.halfH;
  /** Ancho útil para el reloj cuando gira (deja un margen a los lados). */
  const roomW = width * 0.94;
  const objectTransform = useDerivedValue(() => {
    const p = objectPose(
      pose ? pose.rotate.value : 0,
      pose ? pose.scale.value : 1,
      pose ? pose.centered.value : 0,
      spin.value,
      roomW,
      objW,
      objH,
      toScreenCenter,
    );
    return [{ translateY: p.dy }, { scale: p.scale }, { rotate: p.angle }];
  });
  const objectOpacity = useDerivedValue(() => (pose ? pose.opacity.value : 1));
  const shadowOpacity = useDerivedValue(
    () => (pose ? pose.shadow.value : 1) * (1 - 0.9 * Math.abs(Math.sin(spin.value))),
  );
  // Un <Picture> no hereda la opacidad de su grupo: para desvanecerlo hace
  // falta una capa (saveLayer). Las capas cuestan, así que SOLO existen
  // mientras se anima: introducción (`poseActive`) o giro de fase (`turning`).
  const objectLayer = poseActive ? <Paint opacity={objectOpacity} /> : undefined;
  const shadowLayer = poseActive || turning ? <Paint opacity={shadowOpacity} /> : undefined;

  // Desenfoque suave al entrar Y al salir de la pausa (con «reducir
  // movimiento», directo). El filtro solo existe mientras hace falta (cuesta
  // GPU): se crea al pausar y se quita cuando el desenfoque ha vuelto a 0.
  const blur = useSharedValue(0);
  const target = PAUSE_BLUR_PX[pauseBlur];
  const [blurLayerOn, setBlurLayerOn] = useState(target > 0);
  // Patrón «estado derivado» de React (ajuste durante el render).
  if (target > 0 && !blurLayerOn) setBlurLayerOn(true);
  if (target === 0 && reduceMotion && blurLayerOn) setBlurLayerOn(false);
  useEffect(() => {
    if (reduceMotion) {
      blur.set(target);
      return;
    }
    const off = () => setBlurLayerOn(false);
    blur.set(
      withTiming(target, { duration: target > 0 ? 320 : 240 }, (finished) => {
        'worklet';
        if (finished && target === 0) scheduleOnRN(off);
      }),
    );
  }, [target, reduceMotion, blur]);

  // Vidrio de la pausa de lado, encima de fondo, frasco y nube. Usa el
  // desenfoque y el tinte del menú (vidrioLiquido.ts).
  const pausaOpacidad = useSharedValue(0);
  const progresoTema = useSharedValue(theme.scheme === 'dark' ? 1 : 0);
  useEffect(() => {
    const valor = vidrioPausa ? 1 : 0;
    pausaOpacidad.set(reduceMotion ? valor : withTiming(valor, { duration: valor > 0 ? 320 : 240 }));
  }, [vidrioPausa, reduceMotion, pausaOpacidad]);
  useEffect(() => {
    if (themeProgress) return;
    progresoTema.set(theme.scheme === 'dark' ? 1 : 0);
  }, [theme.scheme, themeProgress, progresoTema]);
  const tintePausa = themeProgress ?? progresoTema;

  // El desenfoque solo cubre la franja del reloj y su sombra (1.8.1). El fondo
  // es un degradado muy suave: desenfocado se ve igual, pero desenfocar toda
  // la pantalla en cada fotograma costaba unas tres veces más en la GPU.
  // Durante la introducción el reloj se mueve por la pantalla: sin recorte.
  const blurClip = useMemo(() => {
    const top = Math.max(0, layout.cy - layout.halfH - BLUR_MARGIN);
    const bottom = Math.min(height, layout.cy + layout.halfH + BLUR_MARGIN + 0.3 * layout.halfH);
    return rect(0, top, width, Math.max(0, bottom - top));
  }, [layout, width, height]);

  // Con el menú delante (en pausa), al menos el desenfoque de la pausa de
  // lado, creciendo con la hoja (1.8.6). Se calcula en el hilo de la
  // interfaz: abrir el menú no cambia nada del árbol de Skia. Sin pausa no
  // hay capa y esto no se dibuja.
  const blurNow = useDerivedValue(() =>
    menuOpenness ? Math.max(blur.value, menuOpenness.value * PAUSE_BLUR_PX.full) : blur.value,
  );
  const layer = blurLayerOn ? (
    <Paint>
      <Blur blur={blurNow} mode="clamp" />
    </Paint>
  ) : undefined;

  // Fundido al cambiar de tema: foto del lienzo antiguo que se desvanece.
  const canvasRef = useCanvasRef();
  const fade = useThemeCrossfade(canvasRef, temaPintado, reduceMotion);
  const claveFoto = fondo.tipo === 'foto' ? fondo.fuente : 0;
  // Foto para el vidrio de la hoja. El lienzo se redibuja en el siguiente
  // fotograma, así que repetimos la foto un par de frames después (al cambiar
  // de tema la primera saldría con el tema viejo).
  useLayoutEffect(() => {
    if (!capturar || !captura) return undefined;
    let vivo = true;
    let frame2 = 0;
    const tomar = () => {
      if (!vivo) return;
      let next: SkImage | null = null;
      try {
        next = canvasRef.current?.makeImageSnapshot() ?? null;
      } catch {
        next = null;
      }
      if (!vivo || !next || next === captura.imagen) return;
      const prev = captura.imagen;
      captura.imagen = next;
      captura.avisar();
      if (prev) disposeLater([prev]);
    };
    tomar();
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(tomar);
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [capturar, captura, width, height, theme.solid, material, claveFoto, canvasRef]);
  // Al cerrar, soltamos la foto cuando la hoja ya ha bajado. Si se vuelve a
  // abrir antes, se cancela y la foto sigue sirviendo.
  useEffect(() => {
    if (!captura || capturar) return undefined;
    const id = setTimeout(() => {
      const prev = captura.imagen;
      if (!prev) return;
      captura.imagen = null;
      captura.avisar();
      disposeLater([prev]);
    }, 400);
    return () => clearTimeout(id);
  }, [capturar, captura]);

  return (
    <Canvas ref={canvasRef} style={{ width, height }}>
      <Group transform={transform} origin={origin}>
        <Picture picture={background} />
        <Group layer={layer} clip={blurLayerOn && !poseActive ? blurClip : undefined}>
          <Group layer={shadowLayer}>
            <Picture picture={shadow} />
          </Group>
          <Group transform={objectTransform} origin={center} layer={objectLayer}>
            <Picture picture={body} />
            <Picture picture={sand} />
            <Picture picture={front} />
          </Group>
        </Group>
        {nubePintada ? (
          <NubeMovil layout={layout} oscuro={temaPintado.scheme === 'dark'} reducir={reduceMotion} />
        ) : null}
        {children}
      </Group>
      {fade.image ? (
        <Image
          image={fade.image}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="fill"
          opacity={fade.opacity}
        />
      ) : null}
      <VidrioPantalla width={width} height={height} opacity={pausaOpacidad} themeProgress={tintePausa} />
    </Canvas>
  );
}

export const Hourglass = memo(HourglassComponent);
