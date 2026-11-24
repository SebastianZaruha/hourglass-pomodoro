/**
 * Tema de una escena con foto. El vidrio no tiñe: tinte blanco y sin la
 * banda marrón del grosor. Los dígitos, la tinta y la barra quedan juntos
 * en cada escena; aquí solo se arma el resto.
 */
import type { ColorSchemeName, HourglassTheme, Rgb01, UiPalette } from '../theme/theme';

export interface ColoresFoto {
  readonly scheme: ColorSchemeName;
  /** Dígitos del reloj. */
  readonly digitos: string;
  /** Pista («desliza para elegir»). Sin ella, el color de los dígitos. */
  readonly pista?: string;
  /** Rótulo «Pausa». Sin él, se deriva de los dígitos. */
  readonly pausa?: string;
  /** Enlaces y texto del menú. */
  readonly tinta: string;
  /** Icono suelto sobre la foto (las rayas del menú). No es la tinta. */
  readonly icono: string;
  /** Barra de estado y color sólido de la pantalla. */
  readonly barra: string;
  /** Plano de reserva mientras llega la foto. */
  readonly reserva: string;
  /** Sombra del frasco sobre la foto. */
  readonly sombra: string;
  /** Relleno de segmento, chip y botón redondo sobre el vidrio. */
  readonly controles?: ControlesEscena;
}

/**
 * Color de los controles del menú. En Arena y Lluvia son hex opacos: el
 * fundido del tema interpola el color y el texto a la vez. `textoSuave` es
 * el texto secundario (chip sin seleccionar, etiquetas, −/+). `sobreAcento`
 * es el icono del botón relleno. La tinta principal vive en cada escena.
 */
export interface ControlesEscena {
  readonly track: string;
  readonly pill: string;
  readonly accent: string;
  readonly textoSuave?: string;
  readonly sobreAcento?: string;
}

/** Valores por escena y por claro/oscuro. Se editan aquí. */
export const CONTROLES = {
  clasico: {
    light: {
      track: 'rgba(92, 78, 64, 0.16)',
      pill: 'rgba(255, 252, 247, 0.98)',
      accent: '#6E5A48',
    },
    dark: {
      track: 'rgba(255, 238, 214, 0.14)',
      pill: 'rgba(255, 238, 214, 0.24)',
      accent: '#D4C0A4',
    },
  },
  lluvia: {
    light: {
      track: '#d7e0dc',
      pill: '#f3f6f4',
      accent: '#3d524c',
      textoSuave: '#141414',
      sobreAcento: '#f4f7f5',
    },
    dark: {
      track: '#1c2824',
      pill: '#2e3c37',
      accent: '#d2e3db',
      textoSuave: '#c5d2cc',
      sobreAcento: '#12201c',
    },
  },
  arena: {
    light: {
      track: '#ead9c6',
      pill: '#fbf6ee',
      accent: '#8a4518',
      textoSuave: '#4a2c16',
      sobreAcento: '#fff8f1',
    },
    dark: {
      track: '#2c1e14',
      pill: '#4e3828',
      accent: '#f0d2b0',
      textoSuave: '#e2cdb4',
      sobreAcento: '#2a1a10',
    },
  },
} as const satisfies Record<string, { light: ControlesEscena; dark: ControlesEscena }>;

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

function uiDe(tinta: string, scheme: ColorSchemeName, controles: ControlesEscena | undefined, icono: string): UiPalette {
  const claro = scheme === 'light';
  const hacia = claro ? '#f7f3ee' : '#f3ece4';
  const suave = claro ? 0.32 : 0.38;
  const suaveTexto = controles?.textoSuave ?? mezcla(tinta, hacia, suave);
  return {
    ink: tinta,
    inkSoft: suaveTexto,
    label: suaveTexto,
    track: controles?.track ?? rgbaDe(tinta, claro ? 0.08 : 0.1),
    pill: controles?.pill ?? (claro ? 'rgba(255, 252, 247, 0.94)' : 'rgba(255, 244, 232, 0.14)'),
    pillShadow: claro
      ? '0px 1px 2px rgba(40, 32, 24, 0.10), 0px 4px 12px rgba(40, 32, 24, 0.07)'
      : '0px 1px 2px rgba(0, 0, 0, 0.35)',
    accent: controles?.accent ?? mezcla(tinta, hacia, claro ? 0.12 : 0.2),
    line: rgbaDe(tinta, claro ? 0.14 : 0.16),
    panelEdge: claro ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 244, 232, 0.1)',
    scrim: claro ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.22)',
    grabber: rgbaDe(tinta, claro ? 0.28 : 0.4),
    menuIcon: icono,
    onAccent: controles?.sobreAcento ?? (claro ? '#fffdf9' : '#1c1612'),
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
      hint: c.pista ?? c.digitos,
      pause: c.pausa ?? (claro ? mezcla(c.digitos, '#3a342e', 0.35) : mezcla(c.digitos, '#f3ece4', 0.55)),
      pauseGlow: claro ? 'rgba(250, 246, 240, 0.95)' : 'rgba(12, 10, 8, 0.9)',
    },
    solid: c.barra,
    ui: uiDe(c.tinta, c.scheme, c.controles, c.icono),
  };
}
