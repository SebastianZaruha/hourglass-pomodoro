/**
 * Tema de una escena con foto. El vidrio no tiñe: tinte blanco y sin la
 * banda marrón del grosor. Los dígitos, la tinta y la barra quedan juntos
 * en cada escena; aquí solo se arma el resto.
 */
import type { ColorSchemeName, HourglassTheme, Rgb01, UiPalette } from '../theme/theme';

export interface ColoresFoto {
  readonly scheme: ColorSchemeName;
  /** Dígitos y pista del reloj. */
  readonly digitos: string;
  /** Enlaces y texto del menú. */
  readonly tinta: string;
  /** Barra de estado y color sólido de la pantalla. */
  readonly barra: string;
  /** Plano de reserva mientras llega la foto. */
  readonly reserva: string;
  /** Sombra del frasco sobre la foto. */
  readonly sombra: string;
}

const hex = (h: string): Rgb01 => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function mezcla(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const canal = (desp: number) => {
    const ca = (pa >> desp) & 255;
    const cb = (pb >> desp) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  const n = (canal(16) << 16) | (canal(8) << 8) | canal(0);
  return `#${n.toString(16).padStart(6, '0')}`;
}

function rgbaDe(hexColor: string, alfa: number): string {
  const n = parseInt(hexColor.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

function uiDe(tinta: string, scheme: ColorSchemeName): UiPalette {
  const claro = scheme === 'light';
  const hacia = claro ? '#f7f3ee' : '#f3ece4';
  const suave = claro ? 0.32 : 0.38;
  return {
    ink: tinta,
    inkSoft: mezcla(tinta, hacia, suave),
    label: mezcla(tinta, hacia, claro ? 0.22 : 0.28),
    track: rgbaDe(tinta, claro ? 0.08 : 0.1),
    pill: claro ? 'rgba(255, 252, 247, 0.94)' : 'rgba(255, 244, 232, 0.14)',
    pillShadow: claro
      ? '0px 1px 2px rgba(40, 32, 24, 0.10), 0px 4px 12px rgba(40, 32, 24, 0.07)'
      : '0px 1px 2px rgba(0, 0, 0, 0.35)',
    accent: mezcla(tinta, hacia, claro ? 0.12 : 0.2),
    line: rgbaDe(tinta, claro ? 0.14 : 0.16),
    panelEdge: claro ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 244, 232, 0.1)',
    scrim: claro ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.22)',
    grabber: rgbaDe(tinta, claro ? 0.2 : 0.28),
    menuIcon: mezcla(tinta, hacia, claro ? 0.42 : 0.34),
    onAccent: claro ? '#fffdf9' : '#1c1612',
    tooltip: claro ? 'rgba(255, 252, 247, 0.98)' : 'rgba(36, 30, 26, 0.98)',
  };
}

/** Tema de foto. El tinte del vidrio es blanco: no beige y no azul. */
export function temaDeFoto(c: ColoresFoto): HourglassTheme {
  const plano = hex(c.reserva);
  const claro = c.scheme === 'light';
  return {
    scheme: c.scheme,
    background: {
      top: plano,
      bottom: plano,
      glow: plano,
      glowPos: [0.22, 0.16],
      vignette: plano,
    },
    glass: {
      tint: [1, 1, 1],
      reflection: claro ? 1 : 0.55,
      edge: claro ? 'rgba(70, 70, 70, 0.38)' : 'rgba(0, 0, 0, 0.45)',
      edgeHighlight: claro ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.3)',
    },
    shadow: {
      color: c.sombra,
      contact: claro ? 'rgba(40, 32, 24, 0.45)' : 'rgba(0, 0, 0, 0.6)',
      caustic: claro ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)',
    },
    sand: {
      exposure: claro ? 1 : 0.92,
      stream: claro ? 'rgba(176, 148, 112, 0.95)' : 'rgba(170, 142, 106, 0.95)',
    },
    text: {
      time: c.digitos,
      hint: c.digitos,
      pause: claro ? mezcla(c.digitos, '#3a342e', 0.35) : mezcla(c.digitos, '#f3ece4', 0.55),
      pauseGlow: claro ? 'rgba(250, 246, 240, 0.95)' : 'rgba(12, 10, 8, 0.9)',
    },
    solid: c.barra,
    ui: uiDe(c.tinta, c.scheme),
  };
}
