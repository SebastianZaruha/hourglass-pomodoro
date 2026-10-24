/**
 * Fundido del vidrio de la hoja de ajustes (1.8.4).
 *
 * Hasta la 1.8.3 el vidrio salía de golpe al montarse y se iba de golpe al
 * desmontarlo, con la hoja aún moviéndose. Ahora la intensidad del vidrio
 * (panel, sombra y filo; hasta la 1.8.8 también el radio del desenfoque,
 * que ya no existe) sigue a la hoja: 0 con la hoja escondida, 1 cuando ha
 * subido `fullAt` de su recorrido.
 * Así el vidrio ya está entero cuando la hoja tapa algo y, al cerrar, llega
 * a 0 justo antes de desmontarse.
 *
 * Es un worklet: lo calcula el hilo de la interfaz en cada fotograma.
 */
export const GLASS_FULL_AT = 0.55;

/**
 * 0..1 según lo abierta que está la hoja (`openness`, 0..1). Curva suave (ease-out).
 *
 * OJO (1.8.5): en un worklet no puede haber parámetros con valor por defecto que usen
 * constantes de fuera. El plugin de worklets declara esas constantes DENTRO del cuerpo
 * (`const [GLASS_FULL_AT] = this.__closure`), y el valor por defecto se evalúa antes, en
 * el ámbito de los parámetros: en el hilo de la interfaz daba «GLASS_FULL_AT no existe» y
 * la app se cerraba al abrir el menú (1.8.4). Lo vigila `test/worklets.test.ts`.
 */
export function glassFade(openness: number, fullAt?: number): number {
  'worklet';
  const full = fullAt === undefined ? GLASS_FULL_AT : fullAt;
  if (!(openness > 0) || !(full > 0)) return 0;
  const t = Math.min(1, openness / full);
  return 1 - (1 - t) * (1 - t);
}
