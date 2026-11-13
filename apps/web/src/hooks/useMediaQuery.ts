import { useEffect, useState } from 'react';

import { esAncha } from '../layout/calcularLayout';
import { entradaDe } from '../layout/medidas';
import { conexionAhorro } from '../medios/assetLoader';

function useConsulta(query: string): boolean {
  const [coincide, setCoincide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const alCambiar = () => setCoincide(media.matches);
    media.addEventListener('change', alCambiar);
    return () => media.removeEventListener('change', alCambiar);
  }, [query]);
  return coincide;
}

/** Tamaño, esquema del sistema, reducir movimiento y ahorro de datos. Una sola escucha. */
export function useMedios() {
  const oscuroSistema = useConsulta('(prefers-color-scheme: dark)');
  const reducir = useConsulta('(prefers-reduced-motion: reduce)');
  const [ahorro, setAhorro] = useState(() => {
    const red = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
    return conexionAhorro(red.connection);
  });
  const [tamano, setTamano] = useState(() => ({ ancho: window.innerWidth, alto: window.innerHeight }));

  useEffect(() => {
    const alCambiar = () => setTamano({ ancho: window.innerWidth, alto: window.innerHeight });
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);

  useEffect(() => {
    const red = navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
        addEventListener?: (t: string, fn: () => void) => void;
      };
    };
    const conexion = red.connection;
    if (!conexion?.addEventListener) return;
    const alCambiar = () => setAhorro(conexionAhorro(conexion));
    conexion.addEventListener('change', alCambiar);
    return () => {
      const quitar = conexion as { removeEventListener?: (t: string, fn: () => void) => void };
      quitar.removeEventListener?.('change', alCambiar);
    };
  }, []);

  return {
    oscuroSistema,
    reducir,
    ahorro,
    ancho: tamano.ancho,
    alto: tamano.alto,
    ancha: esAncha(entradaDe(tamano.ancho, tamano.alto, false)),
  };
}
