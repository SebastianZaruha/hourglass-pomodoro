import { useEffect, useState } from 'react';

import { useTactil } from '../../entrada/tactil';
import './mano.css';

const CLAVE = 'hourglass-web/mano';

function yaVista(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return true;
  }
}

function marcarVista(): void {
  try {
    localStorage.setItem(CLAVE, '1');
  } catch {
    // Si no se puede guardar, no se repite en esta pestaña: el estado ya la cierra.
  }
}

interface Props {
  readonly visible: boolean;
}

/**
 * La primera vez, una mano enseña el clic, la rueda y el arrastre.
 * En táctil, el toque y el desliz. Luego no vuelve.
 */
export function Mano({ visible }: Props) {
  const tactil = useTactil();
  const [paso, setPaso] = useState(0);
  const [abierta, setAbierta] = useState(() => visible && !yaVista());

  useEffect(() => {
    if (!visible || yaVista()) return;
    setAbierta(true);
  }, [visible]);

  useEffect(() => {
    if (!abierta) return;
    const cerrar = () => {
      marcarVista();
      setAbierta(false);
    };
    const id = window.setTimeout(cerrar, 11000);
    window.addEventListener('pointerdown', cerrar, { once: true });
    window.addEventListener('wheel', cerrar, { once: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', cerrar);
      window.removeEventListener('wheel', cerrar);
    };
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return;
    const id = window.setInterval(() => setPaso((n) => (n + 1) % 3), 3200);
    return () => window.clearInterval(id);
  }, [abierta]);

  if (!abierta) return null;
  const es = document.documentElement.lang !== 'en';
  const textos = tactil
    ? es
      ? ['Toca para empezar', 'Desliza para el tiempo', 'Arrastra para inclinar']
      : ['Tap to start', 'Swipe to set the time', 'Drag to tilt']
    : es
      ? ['Clic para empezar', 'Rueda para el tiempo', 'Arrastra para inclinar']
      : ['Click to start', 'Scroll to set the time', 'Drag to tilt'];
  const gesto = tactil ? (['toque', 'deslizar', 'arrastrar'] as const) : (['clic', 'rueda', 'arrastrar'] as const);

  return (
    <div className="mano" aria-hidden="true">
      <div className={`mano-dibujo mano-${gesto[paso]}`}>
        <span className="mano-palma" />
        <span className="mano-dedo" />
      </div>
      <p className="mano-texto">{textos[paso]}</p>
    </div>
  );
}
