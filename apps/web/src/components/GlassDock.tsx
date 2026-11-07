/**
 * Fila de cristal de la web.
 *
 * Ventana grande: se queda. Ventana pequeña: oculta, y aparece al pasar
 * el ratón o al enfocar, con un retardo al salir para que no parpadee.
 * En una pantalla táctil sin hover se queda solo el botón de menú de siempre.
 */
import { MATERIAL_IDS, dockIsRoomy, type MaterialId, type Messages } from '@reloj/core';
import { useEffect, useState } from 'react';

const HIDE_MS = 320;

interface Props {
  readonly t: Messages;
  readonly running: boolean;
  readonly contentId: MaterialId;
  readonly onToggle: () => void;
  readonly onRestart: () => void;
  readonly onMinutes: (min: number) => void;
  readonly onMaterial: (id: MaterialId) => void;
  readonly onMenu: () => void;
}

export function GlassDock(props: Props) {
  const [roomy, setRoomy] = useState(() => dockIsRoomy(window.innerWidth, window.innerHeight));
  const [hot, setHot] = useState(false);
  const [hoverNone, setHoverNone] = useState(false);

  useEffect(() => {
    const apply = () => {
      const next = dockIsRoomy(window.innerWidth, window.innerHeight);
      setRoomy(next);
      document.querySelector('.app')?.setAttribute('data-roomy', next ? 'yes' : 'no');
    };
    apply();
    document
      .querySelector('.app')
      ?.setAttribute('data-roomy', dockIsRoomy(window.innerWidth, window.innerHeight) ? 'yes' : 'no');
    window.addEventListener('resize', apply);
    const mq = window.matchMedia('(hover: none)');
    const hover = () => setHoverNone(mq.matches);
    hover();
    mq.addEventListener('change', hover);
    return () => {
      window.removeEventListener('resize', apply);
      mq.removeEventListener('change', hover);
    };
  }, []);

  useEffect(() => {
    if (roomy || hoverNone) return;
    let timer: number | null = null;
    const enter = () => {
      if (timer !== null) window.clearTimeout(timer);
      setHot(true);
    };
    const leave = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => setHot(false), HIDE_MS);
    };
    const root = document.querySelector('.app');
    root?.addEventListener('pointerenter', enter);
    root?.addEventListener('pointerleave', leave);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      root?.removeEventListener('pointerenter', enter);
      root?.removeEventListener('pointerleave', leave);
    };
  }, [roomy, hoverNone]);

  const shown = roomy || (!hoverNone && hot);
  const names: Record<MaterialId, string> = {
    arena: props.t.materialSand,
    lluvia: props.t.materialRain,
    miel: props.t.materialHoney,
    nieve: props.t.materialSnow,
  };

  return (
    <div
      className={shown ? 'dock shown' : 'dock'}
      data-roomy={roomy ? 'yes' : 'no'}
      role="toolbar"
      aria-label={props.t.settings}
      aria-hidden={!shown}
    >
      <button type="button" className="dock-btn dock-main" onClick={props.onToggle}>
        {props.running ? props.t.pause : props.t.start}
      </button>
      <button type="button" className="dock-btn" onClick={props.onRestart}>
        {props.t.restart}
      </button>
      <button type="button" className="dock-btn" onClick={() => props.onMinutes(5)}>
        5
      </button>
      <button type="button" className="dock-btn" onClick={() => props.onMinutes(25)}>
        25
      </button>
      {MATERIAL_IDS.map((id) => (
        <button
          key={id}
          type="button"
          className={id === props.contentId ? 'dock-btn on' : 'dock-btn'}
          aria-pressed={id === props.contentId}
          onClick={() => props.onMaterial(id)}
        >
          {names[id]}
        </button>
      ))}
      <button type="button" className="dock-btn" onClick={props.onMenu}>
        {props.t.settings}
      </button>
    </div>
  );
}
