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

export function useFondoImagen(fuente: number | null): SkImage | null {
  const [imagen, setImagen] = useState<SkImage | null>(null);

  useEffect(() => {
    if (fuente == null) {
      setImagen(null);
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
      setImagen(creada);
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

  return imagen;
}
