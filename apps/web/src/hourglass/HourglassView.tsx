import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

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
  const hover = useRef({ x: 0, y: 0, t: 0, shook: 0 });
  useHourglass(canvasRef, paramsRef, handleRef);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (drag.current.on || e.buttons !== 0) return;
      const canvas = canvasRef.current;
      const layout = handleRef.current?.layoutCss();
      if (!canvas || !layout) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      const prev = hover.current;
      const dt = now - prev.t;
      const dist = Math.hypot(x - prev.x, y - prev.y);
      prev.x = x;
      prev.y = y;
      prev.t = now;
      if (dt <= 0 || dt > 160) return;
      if (paramsRef.current.flipBusy || paramsRef.current.reduceMotion) return;
      if (!hitVessel(layout, x, y)) return;
      const minSpeed = Math.max(0.3, layout.halfW * 0.002);
      if (dist / dt < minSpeed || now - prev.shook < 720) return;
      prev.shook = now;
      paramsRef.current.shakeToken += 1;
      handleRef.current?.wake();
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [handleRef, paramsRef]);

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
