import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

import { hitVessel } from './draw';
import { useHourglass, type HourglassHandle, type HourglassParams } from './useEngine';

/** A partir de aquí el suelte completa el medio giro (180°). */
const FLIP_COMMIT = Math.PI * 0.45;

interface Props {
  readonly paramsRef: RefObject<HourglassParams>;
  readonly handleRef: RefObject<HourglassHandle | null>;
  /** Si el arrastre movió el reloj, el clic no debe pausar. */
  readonly suppressClickRef: RefObject<boolean>;
  /** Doble clic o un arrastre que ya es un volteo: giro de 180° y reinicio. */
  readonly onFlip: () => void;
}

export function HourglassView({ paramsRef, handleRef, suppressClickRef, onFlip }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef({ on: false, startAng: 0, startRot: 0, moved: false });
  useHourglass(canvasRef, paramsRef, handleRef);

  const localPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className="glass-frame">
      <canvas
        ref={canvasRef}
        className="glass-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          if (paramsRef.current.flipBusy) return;
          const layout = handleRef.current?.layoutCss();
          if (!layout) return;
          const p = localPoint(e);
          if (!hitVessel(layout, p.x, p.y)) return;
          const ang = Math.atan2(p.y - layout.cy, p.x - layout.cx);
          drag.current = { on: true, startAng: ang, startRot: paramsRef.current.gestureAngle, moved: false };
          paramsRef.current.gestureActive = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          handleRef.current?.wake();
        }}
        onPointerMove={(e) => {
          if (!drag.current.on) return;
          const layout = handleRef.current?.layoutCss();
          if (!layout) return;
          const p = localPoint(e);
          const ang = Math.atan2(p.y - layout.cy, p.x - layout.cx);
          let delta = ang - drag.current.startAng;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          if (Math.abs(delta) > 0.03) drag.current.moved = true;
          let next = drag.current.startRot + delta;
          if (next > Math.PI) next = Math.PI;
          if (next < -Math.PI) next = -Math.PI;
          paramsRef.current.gestureAngle = next;
          handleRef.current?.wake();
        }}
        onPointerUp={(e) => {
          if (!drag.current.on) return;
          drag.current.on = false;
          paramsRef.current.gestureActive = false;
          const ang = paramsRef.current.gestureAngle;
          if (Math.abs(ang) >= FLIP_COMMIT) {
            suppressClickRef.current = true;
            onFlip();
          } else if (drag.current.moved) {
            suppressClickRef.current = true;
          }
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          handleRef.current?.wake();
        }}
        onPointerCancel={() => {
          drag.current.on = false;
          paramsRef.current.gestureActive = false;
          handleRef.current?.wake();
        }}
      />
    </div>
  );
}
