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
 * Canto al píxel (1.8.7): `top` y el desplazamiento de la vista se
 * redondean al píxel físico (`snapToPixel`). Al final de la subida la hoja
 * avanza décimas de píxel por fotograma; el filo de luz del vidrio (Skia)
 * caía entre píxeles y su suavizado cambiaba de un fotograma a otro, y
 * podía ir medio píxel por delante o por detrás del contenido (React
 * Native). Redondeados igual, van juntos y el filo queda quieto y nítido.
 *
 * Nota: fuera de los worklets usamos `sv.get()` / `sv.set()` en lugar de
 * `sv.value`: es lo que recomienda Reanimated 4 para que las reglas del
 * React Compiler (lint) entiendan que no estamos mutando un valor de React.
 */
import { SheetToggle, snapToPixel } from '@reloj/core';
import { useCallback, useLayoutEffect, useState } from 'react';
import { PixelRatio } from 'react-native';
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
  // Alto provisional hasta medir el contenido (lo fija SettingsSheet).
  const height = useSharedValue(Math.round(screenHeight * 0.7));
  const offset = useSharedValue(screenHeight);
  // El borde de arriba de la vista (lo coloca Yoga, ya en píxeles enteros)
  // más el desplazamiento, redondeados por separado como la vista.
  const top = useDerivedValue(
    () => snapToPixel(screenHeight - height.value, SHEET_DENSITY) + snapToPixel(offset.value, SHEET_DENSITY),
  );
  const openness = useDerivedValue(() =>
    height.value > 0 ? Math.min(1, Math.max(0, 1 - offset.value / height.value)) : 0,
  );

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
    if (!gate.hide(Date.now(), reduceMotion ? 0 : SHEET_CLOSE_MS)) return;
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

  const hideNow = useCallback(() => {
    gate.reset();
    cancelAnimation(offset);
    offset.set(height.get() + 40);
    setOpen(false);
    setVisible(false);
  }, [gate, offset, height]);

  return { open, visible, offset, height, top, openness, show, hide, toggle, hideNow };
}
