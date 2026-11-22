/**
 * Estado y animación de la hoja de ajustes.
 *
 * Todo gira en torno a UN shared value, `offset`: cuánto está la hoja
 * desplazada hacia abajo (0 = abierta del todo; `height` = escondida). De
 * él se derivan:
 *   - `top`: el canto superior en la pantalla (lo usa el vidrio Skia),
 *   - `openness`: 0..1 (velo, fundido del tiempo y del botón).
 * El gesto de arrastrar escribe en `offset` directamente (en el hilo de UI),
 * así el contenido (React Native) y el vidrio (Skia) se mueven a la vez.
 *
 * Canto al píxel (1.8.7): `top` se redondea al píxel físico (`snapToPixel`).
 * La vista usa ese mismo `top` (no un `translateY` sobre `bottom: 0`): si el
 * padre medía 0 al arrancar, `bottom: 0` era el borde de arriba y la hoja
 * cerrada —desplazada «hacia abajo»— quedaba pintada en la pantalla, sin
 * vidrio, con el frasco encima. Cerrada no se monta.
 *
 * Nota: fuera de los worklets usamos `sv.get()` / `sv.set()` en lugar de
 * `sv.value`: es lo que recomienda Reanimated 4 para que las reglas del
 * React Compiler (lint) entiendan que no estamos mutando un valor de React.
 */
import { SheetToggle, snapToPixel } from '@reloj/core';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Dimensions, PixelRatio } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export const SHEET_OPEN_MS = 340;
export const SHEET_CLOSE_MS = 260;
/** Píxeles físicos por punto (para `snapToPixel`). */
export const SHEET_DENSITY = PixelRatio.get();

/**
 * Alto de pantalla para el estado cerrado. `useWindowDimensions` puede dar 0
 * en el primer render: un offset 0 es la hoja ABIERTA (`top` = 0) y se ve
 * al arrancar, antes de que llegue el layout.
 */
function altoDePantalla(screenHeight: number): number {
  if (screenHeight > 0) return screenHeight;
  const medida = Dimensions.get('screen').height;
  return medida > 0 ? medida : 800;
}

export interface SheetState {
  /** ¿Está abierta (o abriéndose)? */
  readonly open: boolean;
  /** ¿Hay que dibujar el vidrio? (abierta o todavía cerrándose) */
  readonly visible: boolean;
  readonly offset: SharedValue<number>;
  readonly height: SharedValue<number>;
  readonly top: SharedValue<number>;
  readonly openness: SharedValue<number>;
  readonly show: () => void;
  readonly hide: () => void;
  /**
   * Para el botón del menú (1.8.2): abre o cierra, pero ignora los toques
   * mientras la hoja se está moviendo. Así unos toques de más (p. ej. si la
   * hoja tarda en salir) no la cierran nada más abrirse.
   */
  readonly toggle: () => void;
  /**
   * Cierra al momento, sin animación (1.8.10): al salir de la app, para que
   * al volver el menú esté cerrado y no se vea bajar.
   */
  readonly hideNow: () => void;
}

export function useSheet(screenHeight: number, reduceMotion: boolean): SheetState {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  // Cerrada desde el primer valor: un offset 0 dejaría `top` en 0 y la hoja
  // ocuparía la pantalla en el primer frame, antes de medirla.
  const pantalla = altoDePantalla(screenHeight);
  const height = useSharedValue(Math.round(pantalla * 0.7));
  const offset = useSharedValue(pantalla);
  // En un shared value: el worklet de `top` no se queda con el 0 del primer
  // render si la medida de verdad llega después.
  const alto = useSharedValue(pantalla);
  useLayoutEffect(() => {
    if (screenHeight > 0) alto.set(screenHeight);
  }, [screenHeight, alto]);
  // Canto superior de la propia vista. Cerrada (offset ≥ alto de la hoja)
  // queda en o bajo el borde inferior, también antes del primer layout.
  const top = useDerivedValue(
    () => snapToPixel(alto.value - height.value, SHEET_DENSITY) + snapToPixel(offset.value, SHEET_DENSITY),
  );
  const openness = useDerivedValue(() =>
    height.value > 0 ? Math.min(1, Math.max(0, 1 - offset.value / height.value)) : 0,
  );

  // Si el alto de verdad llega después (el primer render iba a 0), la hoja
  // sigue cerrada: el canto queda por debajo de la pantalla. No toca una
  // hoja abierta ni una que se está cerrando.
  useLayoutEffect(() => {
    if (open || visible || !(screenHeight > 0)) return;
    if (offset.get() < screenHeight) offset.set(Math.max(height.get() + 40, screenHeight));
  }, [screenHeight, open, visible, offset, height]);

  // Estado real al momento (el `open` de React llega un render después) y
  // qué hacer con cada toque del botón (ver SheetToggle en el core).
  const [gate] = useState(() => new SheetToggle());

  // Cada apertura pedida (el número sube): la animación arranca en el
  // efecto de abajo, cuando React ya ha aplicado la hoja abierta.
  const [opening, setOpening] = useState(0);

  const show = useCallback(() => {
    // Ya abierta o abriéndose: nada que hacer.
    if (!gate.show(Date.now(), reduceMotion ? 0 : SHEET_OPEN_MS)) return;
    setVisible(true);
    setOpen(true);
    setOpening((n) => n + 1);
  }, [gate, reduceMotion]);

  // La subida empieza con el render que monta el vidrio (1.8.4), no antes:
  // en Android ese render tarda unas decenas de ms y, si la animación ya
  // corría, los primeros fotogramas se perdían (la hoja «saltaba») y el
  // contenido se veía un instante sobre el reloj nítido, sin vidrio.
  useLayoutEffect(() => {
    if (opening === 0) return;
    // Si estaba escondida del todo, empieza justo por debajo del borde.
    if (offset.get() > height.get()) offset.set(height.get());
    offset.set(
      reduceMotion ? 0 : withTiming(0, { duration: SHEET_OPEN_MS, easing: Easing.out(Easing.cubic) }),
    );
    // Solo al pedir una apertura (no al cambiar `reduceMotion` con la hoja abierta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening]);

  const hide = useCallback(() => {
    if (!gate.hide(Date.now(), reduceMotion ? 0 : SHEET_CLOSE_MS)) {
      // Ya estaba cerrada. Si el velo se quedó montado (la animación no
      // avisó), un toque tiene que devolver la pantalla: si no, no responde.
      setVisible(false);
      return;
    }
    setOpen(false);
    const finish = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(setVisible, false);
    };
    if (reduceMotion) {
      offset.set(height.get() + 40);
      setVisible(false);
      return;
    }
    offset.set(
      withTiming(height.get() + 40, { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.quad) }, finish),
    );
  }, [gate, offset, height, reduceMotion]);

  const toggle = useCallback(() => {
    const action = gate.press(Date.now());
    if (action === 'show') show();
    if (action === 'hide') hide();
  }, [gate, show, hide]);

  // La animación de cierre a veces no avisa (Android). Sin esto `visible`
  // se queda en true, el velo a pantalla completa sigue montado y se come
  // todos los toques: hide() ya no hace nada porque la hoja consta cerrada.
  useEffect(() => {
    if (open || !visible) return undefined;
    const id = setTimeout(() => {
      if (!gate.isOpen) setVisible(false);
    }, (reduceMotion ? 0 : SHEET_CLOSE_MS) + 120);
    return () => clearTimeout(id);
  }, [open, visible, reduceMotion, gate]);

  const hideNow = useCallback(() => {
    gate.reset();
    cancelAnimation(offset);
    offset.set(height.get() + 40);
    setOpen(false);
    setVisible(false);
  }, [gate, offset, height]);

  return { open, visible, offset, height, top, openness, show, hide, toggle, hideNow };
}
