/**
 * Foto del lienzo del reloj para el vidrio de la hoja.
 *
 * La escribe el reloj en el hilo de JS y la lee la hoja. No va en un shared
 * value: un SkImage no debe cruzar al hilo de la interfaz por Reanimated
 * (ver useThemeCrossfade).
 */
import type { SkImage } from '@shopify/react-native-skia';

export interface CapturaReloj {
  imagen: SkImage | null;
  avisar: () => void;
  suscribir: (fn: () => void) => () => void;
}

export function crearCaptura(): CapturaReloj {
  const oyentes = new Set<() => void>();
  return {
    imagen: null,
    avisar() {
      for (const fn of oyentes) fn();
    },
    suscribir(fn) {
      oyentes.add(fn);
      return () => {
        oyentes.delete(fn);
      };
    },
  };
}
