import { geometriaDelFrasco, layoutFor, type Contenido, type MedidaLienzo } from '../../../comun/frasco';
import { crearModelo } from './modelo';
import { crearPincel } from './pintar';

/**
 * El agua de Lluvia. No comparte leyes con la arena:
 * es una masa, con su superficie y su vaivén.
 */
export function crearAgua(medida: MedidaLienzo, _esquema: 'claro' | 'oscuro'): Contenido {
  const modelo = crearModelo();
  const pintarAgua = crearPincel();
  const layout = layoutFor(medida.ancho, medida.alto);
  let ancho = layout.halfW * 2;
  let alto = layout.halfH * 2;
  let muerto = false;

  void geometriaDelFrasco().then(
    (geo) => {
      if (!muerto) modelo.fijarGeo(geo);
    },
    () => modelo.fallar(),
  );

  return {
    paso(e) {
      return modelo.paso(e, ancho, alto);
    },
    pintar(ctx, p) {
      ancho = p.caja.w;
      alto = p.caja.h;
      pintarAgua(ctx, p, modelo.vista());
    },
    alVoltear(motivo, snap) {
      modelo.alVoltear(motivo, snap);
    },
    destruir() {
      muerto = true;
      modelo.destruir();
    },
  };
}
