/**
 * Carga la foto de una escena y suelta la anterior en diferido.
 * Como mucho dos imágenes vivas: la actual y la del fundido.
 */
import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { disposeLater } from '../hourglass/disposal';

const MAX_VIVAS = 2;
const vivas: SkImage[] = [];

function soltarSiSobra(): void {
  while (vivas.length > MAX_VIVAS) {
    disposeLater([vivas.shift()]);
  }
}

/** La imagen y la fuente a la que pertenece. Mientras carga otra, sigue la anterior. */
export function useFondoImagen(fuente: number | null): { fuente: number | null; imagen: SkImage | null } {
  const [estado, setEstado] = useState<{ fuente: number | null; imagen: SkImage | null }>({
    fuente: null,
    imagen: null,
  });

  useEffect(() => {
    if (fuente == null) {
      setEstado({ fuente: null, imagen: null });
      return;
    }
    let cancelado = false;
    const uri = Image.resolveAssetSource(fuente)?.uri;
    if (!uri) return;
    void Skia.Data.fromURI(uri).then((data) => {
      const creada = Skia.Image.MakeImageFromEncoded(data);
      data.dispose();
      if (cancelado || !creada) {
        creada?.dispose();
        return;
      }
      vivas.push(creada);
      soltarSiSobra();
      setEstado({ fuente, imagen: creada });
    });
    return () => {
      cancelado = true;
    };
  }, [fuente]);

  useEffect(
    () => () => {
      const pendientes = vivas.splice(0, vivas.length);
      disposeLater(pendientes);
    },
    [],
  );

  return estado;
}
