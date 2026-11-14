/** El lavado de la luz sobre el vidrio de delante. El factor es cosmético. */
export const FACTOR_LUZ = 0.45;

export interface LuzEscena {
  readonly direccion: number;
  readonly tinte: string;
  readonly fuerza: number;
}

let placa: HTMLCanvasElement | null = null;

/**
 * Degradado en el mundo, solo encima del vidrio de delante.
 * Con fuerza 0 no pinta nada: Clásico sigue con su degradado publicado.
 */
export function pintarLuz(
  ctx: CanvasRenderingContext2D,
  frente: CanvasImageSource,
  caja: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  luz: LuzEscena,
): void {
  if (!(luz.fuerza > 0) || caja.w < 2 || caja.h < 2) return;
  const w = Math.max(2, Math.round(caja.w));
  const h = Math.max(2, Math.round(caja.h));
  if (!placa || placa.width !== w || placa.height !== h) {
    placa = document.createElement('canvas');
    placa.width = w;
    placa.height = h;
  }
  const g = placa.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.drawImage(frente, 0, 0, w, h);

  const rad = (luz.direccion * Math.PI) / 180;
  const sx = Math.cos(rad);
  const sy = Math.sin(rad);
  const grad = g.createLinearGradient(
    w / 2 + sx * w * 0.5,
    h / 2 + sy * h * 0.5,
    w / 2 - sx * w * 0.5,
    h / 2 - sy * h * 0.5,
  );
  grad.addColorStop(0, luz.tinte);
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = luz.fuerza * FACTOR_LUZ;
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 1;
  ctx.drawImage(placa, caja.x, caja.y, caja.w, caja.h);
  ctx.restore();
}
