// Intro de Hourglass (comun/frasco/intro.ts y pintarVidrio.ts), copiada tal cual en lo que toca al vidrio:
//   0–300 ms   aparece en el centro, un poco más grande, sin sombra
//   0–900 ms   una vuelta completa, ease-in-out
//   900–1250   vuelve a su sitio y a su tamaño; vuelve la sombra
// Con «reducir movimiento»: sin giro ni desplazamiento, un fundido de 280 ms.
export const INTRO = { fadeIn: 300, spin: 900, settle: 350, chromeDelay: 950, chromeFade: 400, startScale: 1.12, reducedFade: 280 } as const;

/** Pose de la intro. Mismos campos que PoseIntro de Hourglass, más el centrado y la opacidad del vidrio. */
export interface PoseIntro {
  readonly activa: boolean;
  /** Se suma al ángulo del frasco (rad). */
  readonly angulo: number;
  /** Escala pedida (antes de escalaDeIntro). */
  readonly escala: number;
  /** 0..1, multiplica la sombra de contacto. */
  readonly sombra: number;
  /** 0..1: 1 = centrado en la ventana, 0 = en su sitio. Hourglass lo hace con --intro-x/--intro-y. */
  readonly centrado?: number;
  /** 0..1: opacidad del vidrio y su contenido (--intro-glass). */
  readonly opacidad?: number;
}

export const POSE_QUIETA: PoseIntro = { activa: false, angulo: 0, escala: 1, sombra: 1, centrado: 0, opacidad: 1 };

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

/** poseAt de intro.ts. `reducido`: solo el fundido. */
export function poseIntroEn(ms: number, reducido = false): PoseIntro {
  if (reducido) {
    const t = clamp01(ms / INTRO.reducedFade);
    return { activa: t < 1, angulo: 0, escala: 1, sombra: 1, centrado: 0, opacidad: t };
  }
  const spinT = clamp01(ms / INTRO.spin);
  const settle = easeOutCubic(clamp01((ms - INTRO.spin) / INTRO.settle));
  const done = ms >= INTRO.chromeDelay + INTRO.chromeFade;
  if (done) return POSE_QUIETA;
  return {
    activa: true,
    angulo: easeInOutCubic(spinT) * Math.PI * 2,
    escala: INTRO.startScale + (1 - INTRO.startScale) * settle,
    sombra: settle,
    centrado: 1 - settle,
    opacidad: easeOutQuad(clamp01(ms / INTRO.fadeIn)),
  };
}

/** pintarVidrio.ts: encoge el vidrio lo justo para que, de canto, siga cabiendo en el lienzo. */
export function escalaDeIntro(
  base: number,
  layout: { halfW: number; halfH: number },
  angle: number,
  cssW: number,
  cssH: number,
): number {
  const across = Math.abs(Math.sin(angle));
  const along = Math.abs(Math.cos(angle));
  const span = (layout.halfH * 2 * across + layout.halfW * 2 * along) * base;
  const room = Math.min(cssW, cssH) * 0.92;
  if (span <= room || span < 1) return base;
  return (base * room) / span;
}
