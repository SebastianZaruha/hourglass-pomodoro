/**
 * Pose del RELOJ (sin el fondo) dentro del lienzo: la de la introducción
 * (giro, escala, posición) más el giro de cambio de fase.
 *
 * (Hasta la 1.8.8 este archivo era `sceneImage.ts` y también dibujaba la
 * escena en una imagen aparte para el fondo fijo del vidrio del menú. Desde
 * la 1.8.9 el vidrio no tiene desenfoque y esa imagen no hace falta.)
 *
 * Es un worklet: OJO (1.8.5), sin valores por defecto en los parámetros.
 */
export interface ObjectPose {
  readonly dy: number;
  readonly scale: number;
  readonly angle: number;
}

/**
 * Pose del RELOJ (sin el fondo): desplazamiento, escala y giro alrededor de
 * su centro.
 */
export function objectPose(
  poseRotate: number,
  poseScale: number,
  poseCentered: number,
  spin: number,
  roomW: number,
  objW: number,
  objH: number,
  toScreenCenter: number,
): ObjectPose {
  'worklet';
  const angle = poseRotate + spin;
  // Un reloj alto, al girar, se pone horizontal y no cabría a lo ancho:
  // lo encogemos lo justo para que su silueta girada quepa siempre. Es
  // una función continua del ángulo, así que se ve como un «respirar» suave.
  const s = Math.abs(Math.sin(angle));
  const c = Math.abs(Math.cos(angle));
  const fit = Math.min(1, roomW / (objH * s + objW * c));
  // `lift`: 0 en reposo, 1 a mitad del giro de cambio de fase (se «levanta»).
  const lift = Math.abs(Math.sin(spin));
  const scale = poseScale * fit * (1 - 0.04 * lift);
  const dy = poseCentered * toScreenCenter;
  return { dy, scale, angle };
}
