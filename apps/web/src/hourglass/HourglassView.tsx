import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

import { hitGlassSide } from './draw';
import { useHourglass, type HourglassHandle, type HourglassParams } from './useEngine';

interface Props {
  readonly paramsRef: RefObject<HourglassParams>;
  readonly handleRef: RefObject<HourglassHandle | null>;
  /** Si el arrastre movió el reloj, el clic no debe pausar. */
  readonly suppressClickRef: RefObject<boolean>;
  readonly showPause: boolean;
  readonly pauseLabel: string;
}

export function HourglassView({ paramsRef, handleRef, suppressClickRef, showPause, pauseLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef({ on: false, startAng: 0, startRot: 0, moved: false });
  useHourglass(canvasRef, paramsRef, handleRef);

  const localPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className={showPause ? 'glass-frame is-paused' : 'glass-frame'}>
      <canvas
        ref={canvasRef}
        className="glass-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          const layout = handleRef.current?.layoutCss();
          if (!layout) return;
          const p = localPoint(e);
          if (!hitGlassSide(layout, p.x, p.y)) return;
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
          paramsRef.current.gestureAngle = drag.current.startRot + delta;
          handleRef.current?.wake();
        }}
        onPointerUp={(e) => {
          if (!drag.current.on) return;
          drag.current.on = false;
          paramsRef.current.gestureActive = false;
          if (drag.current.moved) suppressClickRef.current = true;
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
      {showPause ? (
        <div className="pause-frost" aria-hidden="true">
          {pauseLabel}
        </div>
      ) : null}
    </div>
  );
}
