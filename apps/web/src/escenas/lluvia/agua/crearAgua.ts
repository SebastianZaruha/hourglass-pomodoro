import { geometriaDelFrasco, layoutFor, type Contenido, type MedidaLienzo } from '../../../comun/frasco';
import { crearModelo } from './modelo';
import { crearPincel } from './pintar';

/** A partir de aquí el chorro se apaga. */
const CORTE_GOTAS = (35 * Math.PI) / 180;
const MS_CORTE = 200;

/**
 * El agua de Lluvia. No comparte leyes con la arena:
 * es una masa, con su superficie y su vaivén.
 * El aspecto es el del módulo de vidrio; el movimiento sigue siendo el de aquí.
 */
export function crearAgua(medida: MedidaLienzo, _esquema: 'claro' | 'oscuro'): Contenido {
  const modelo = crearModelo();
  const pincel = crearPincel((bulbo, s) => modelo.pulso(bulbo, s));
  const layout = layoutFor(medida.ancho, medida.alto);
  let ancho = layout.halfW * 2;
  let alto = layout.halfH * 2;
  let muerto = false;
  let caudal = 0;
  let dtMs = 16;

  void geometriaDelFrasco().then(
    (geo) => {
      if (!muerto) modelo.fijarGeo(geo);
    },
    () => modelo.fallar(),
  );

  return {
    paso(e) {
      dtMs = Math.min(50, Math.max(0, e.dt * 1000));
      const corriendo = e.snap.status === 'running' && e.snap.remainingMs > 0;
      const quiere = corriendo && e.fase !== 'volteo' && Math.abs(e.angulo) < CORTE_GOTAS;
      const dt = Math.min(0.1, Math.max(0, e.dt));
      if (!corriendo && e.snap.status !== 'paused') caudal = 0;
      else if (quiere) caudal = Math.min(1, caudal + dt / (MS_CORTE / 1000));
      else caudal = Math.max(0, caudal - dt / (MS_CORTE / 1000));
      return modelo.paso(e, ancho, alto);
    },
    pintar(ctx, p) {
      ancho = p.caja.w;
      alto = p.caja.h;
      pincel.pintar(ctx, p, modelo.vista(), caudal, dtMs);
    },
    alVoltear(motivo, snap) {
      modelo.alVoltear(motivo, snap);
    },
    destruir() {
      muerto = true;
      modelo.destruir();
      pincel.destruir();
    },
  };
}
