/**
 * Entrada: el fondo nace desenfocado y el frasco aparece en su sitio,
 * con un fundido y un poco de escala. No se desliza.
 */
import { useEffect, useState } from 'react';

const YA = { hecho: false };

export function useEntrada(): { className: string; blocksInput: boolean; settled: boolean } {
  const [reducir] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [fase, setFase] = useState<'espera' | 'entra' | 'lista'>(() => (YA.hecho ? 'lista' : 'espera'));

  useEffect(() => {
    if (YA.hecho) return;
    let vivo = true;
    const mostrar = window.setTimeout(() => {
      if (vivo) setFase('entra');
    }, 30);
    const fin = window.setTimeout(
      () => {
        if (!vivo) return;
        YA.hecho = true;
        setFase('lista');
      },
      reducir ? 320 : 1100,
    );
    return () => {
      vivo = false;
      window.clearTimeout(mostrar);
      window.clearTimeout(fin);
    };
  }, [reducir]);

  if (fase === 'lista') return { className: '', blocksInput: false, settled: true };
  const extra = reducir ? ' entra-corta' : '';
  return {
    className: fase === 'espera' ? `entra entra-espera${extra}` : `entra${extra}`,
    blocksInput: true,
    settled: false,
  };
}
