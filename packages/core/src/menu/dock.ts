/**
 * Barra de cristal de la web.
 *
 * Grande (cabe el frasco y la barra): la fila se queda.
 * Pequeña (ventana de esquina, solo el frasco): solo el botón de menú,
 * y la fila sale al pasar el ratón o al enfocar con el teclado.
 *
 * 960×680: por debajo, en cualquiera de los dos ejes, es pequeña. Un portátil
 * a pantalla completa queda grande; una ventana a un lado, pequeña.
 */
export const DOCK_MIN_WIDTH = 960;
export const DOCK_MIN_HEIGHT = 680;

export function dockIsRoomy(width: number, height: number): boolean {
  return width >= DOCK_MIN_WIDTH && height >= DOCK_MIN_HEIGHT;
}
