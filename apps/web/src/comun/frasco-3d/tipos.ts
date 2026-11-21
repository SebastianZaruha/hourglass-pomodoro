import type { Ancla, Caja } from './encuadre';
import type { Modo } from './entorno';
import type { PoseIntro } from './intro';
export type { Ancla, Caja, Modo, PoseIntro };

/** Igual que FaseGiro de Hourglass. */
export type FaseGiro = 'reposo' | 'arrastre' | 'volviendo' | 'volteo';

export type Calidad = 'alto' | 'medio' | 'bajo';

/** Fondo visible. El lienzo WebGL lo pinta entero; el DOM queda de póster hasta `alListo`. */
export interface Fondo {
  /** Foto o vídeo ya creado (puede estar cargando). */
  fuente: HTMLImageElement | HTMLVideoElement;
  /** Ancla del aspecto (escena.claro/oscuro.ancla). */
  ancla: Ancla;
  /** Dónde apoya el ancla: 'bulbo' (Arena, la duna) o 'base' (resto). */
  pie: 'bulbo' | 'base';
  /** Imagen para el entorno de reflejos si la fuente es vídeo (su póster). */
  poster?: HTMLImageElement;
  /** Clásico: entorno de estudio (softboxes), no la foto. */
  estudio?: boolean;
  /** Tinte de la luz de la escena (#rrggbb). Opcional. */
  tinte?: string;
  /** Sombra de contacto: rgba(r,g,b,a) en 0..255 / 0..1. */
  sombra?: { r: number; g: number; b: number; a: number };
  /** Color de reserva (#rrggbb) mientras la foto o el vídeo no han llegado. Hourglass. */
  reserva?: string;
}

/** Info que recibe un pintor 'mundo' (el agua). */
export interface InfoMundo {
  /** Ángulo del frasco en rad (horario +). */
  angulo: number;
  /** Cuello en px CSS del lienzo. */
  pivote: { x: number; y: number };
  /** cajaFoto en px CSS del lienzo, de pie (sin girar). */
  cajaFoto: Caja;
  /** Caja del fondo (cover anclado) en px CSS del lienzo. */
  cajaFondo: Caja;
  /** ms desde el frame anterior. */
  dt: number;
  /** Hito 2. Escala de la pose (intro, escalaDeIntro). 1 de pie. */
  escala: number;
}

/**
 * Contenido del interior. Se pinta en una hoja en coordenadas de cajaFoto que gira con el frasco.
 *  - 'frasco': pintar(ctx, caja) igual que `pintarContenido` de Hourglass. caja = {0,0,w,h} de cajaFoto.
 *  - 'mundo':  el ctx viene con la transformación mundo→hoja; pinta en px CSS del lienzo (agua horizontal).
 *  - 'canvas': un canvas ya pintado en coordenadas de cajaFoto (por ejemplo la `hoja` de la arena).
 */
export type Contenido =
  | { tipo: 'frasco'; pintar: (ctx: CanvasRenderingContext2D, caja: Caja, dt: number) => void }
  | { tipo: 'mundo'; pintar: (ctx: CanvasRenderingContext2D, info: InfoMundo) => void }
  | { tipo: 'canvas'; canvas: HTMLCanvasElement | OffscreenCanvas };

export interface OpcionesFrasco3D {
  /** 'auto' (por defecto) mide los primeros segundos y baja si hace falta. */
  calidad?: Calidad | 'auto';
  modo?: Modo;
  /** Caja de maquetación (layoutFor) en px CSS del lienzo. Si falta, layoutFor del lienzo entero. */
  caja?: Caja | null;
  /** MSAA. Por defecto: sí con DPR < 2 y calidad no forzada a 'bajo'. Solo al crear. */
  antialias?: boolean;
  /** 'libre': se queda en el ángulo donde lo sueltas. 'vertical': vuelve suave a 0°/180°. */
  reposo?: 'libre' | 'vertical';
  /** Balanceo 3D sutil (±8°) al girar. Por defecto sí (no con reduced-motion). */
  balanceo?: boolean;
  /** Duración de la media vuelta en ms (900). */
  mediaVueltaMs?: number;
  /** Vídeo de fondo: copias por segundo como mucho (30). */
  fpsVideo?: number;
  /** URL de la máscara del interior (jar-mask.webp, 891×2048, blanco = dentro). */
  mascara: string;
  /** Escucha el puntero sobre el lienzo (por defecto sí). */
  interaccion?: boolean;
  alCaja?: (caja: Caja, cajaFoto: Caja) => void;
  alCalidad?: (c: Calidad) => void;
  alListo?: () => void;
  alGirar?: (anguloRad: number) => void;
  /**
   * Hito 2. Qué hace la media vuelta al llegar a 180°.
   *  - 'quedarse' (por defecto, como el hito 1): se queda a 180°.
   *  - 'reiniciar': como el reinicio de Hourglass. Un fotograma a 180° (alVoltear('sujetar')),
   *    y al siguiente el ángulo vuelve a 0 (alVoltear('cerrar')). Ahí llama a contenido.alVoltear.
   */
  volteo?: 'quedarse' | 'reiniciar';
  /** Hito 2. Eventos del volteo con volteo: 'reiniciar' (los de crearGiro: reinicio-sujetar / reinicio-cerrar). */
  alVoltear?: (evento: 'sujetar' | 'cerrar') => void;
}

export interface Frasco3D {
  setFondo(f: Fondo): void;
  setContenido(c: Contenido | null): void;
  setModo(m: Modo): void;
  setCaja(c: Caja | null): void;
  /**
   * caja, cajaFoto y pivote como en el hito 1. Hito 2 (añadidos): pivoteVisible y escala (con la intro;
   * fuera de ella, iguales a pivote y 1) y cajaFondo (cover anclado del fondo, null si aún no ha cargado).
   */
  getCaja(): { caja: Caja; cajaFoto: Caja; pivote: { x: number; y: number }; pivoteVisible: { x: number; y: number }; escala: number; cajaFondo: Caja | null };
  /** Pone el ángulo (rad). animado: con easing. velocidad (rad/s): solo para el balanceo. */
  girar(angulo: number, animado?: boolean, velocidad?: number): void;
  /** Oculta o muestra el vidrio, su contenido y su sombra. El fondo se sigue pintando. Hourglass. */
  setFrascoVisible(visible: boolean): void;
  getAngulo(): number;
  mediaVuelta(): void;
  /** Hito 2. Ángulo visible (con la intro), velocidad (rad/s) y fase, para EntradaPaso del contenido. */
  getEstado(): { angulo: number; velocidad: number; fase: FaseGiro };
  /** Hito 2. Reproduce la intro de Hourglass (≈1,35 s). Con reduced-motion, un fundido. */
  intro(alTerminar?: () => void): void;
  /**
   * Hito 2. Pose de intro llevada desde fuera (p. ej. giro.poseIntro() de Hourglass). null = quieta.
   * Su ángulo NO se suma (girar() ya lo trae: crearGiro.estado().angulo incluye la intro); solo
   * sirve para escalaDeIntro. Escala, sombra, centrado y opacidad sí se aplican.
   */
  setPoseIntro(pose: PoseIntro | null): void;
  setCalidad(c: Calidad | 'auto'): void;
  redimensionar(): void;
  /** Solo para afinar/verificar. */
  depurar(): Record<string, unknown>;
  /** Medidas para la verificación: tiempos de frame recientes y nivel. */
  medidas(): { calidad: Calidad; frames: number; mediaMs: number; p95Ms: number };
  destruir(): void;
}
