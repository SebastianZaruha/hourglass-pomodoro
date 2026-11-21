// La fábrica: crea los buffers una vez y devuelve las funciones de cada frame.
import { crearBulbo, crearGradientes, DESENFOQUE_MAX, pintarBulbo, prepararBulbo, type Gradientes } from './bulbo';
import { crearCopiasFondo, prepararFoto, redimensionarCopias, sincronizarEncaje } from './fondo';
import { crearPiscina, moverYPintarGotas, type ContextoGotas } from './gotas';
import type { AguaVidrio, EstadoAgua, EstadoGotas, FuenteFondo, OpcionesAgua } from './tipos';

export function crearAguaVidrio(opciones: OpcionesAgua): AguaVidrio {
  const copias = crearCopiasFondo(opciones.reduccion ?? 4);
  const bulbos = [crearBulbo(opciones.bulbos[0]), crearBulbo(opciones.bulbos[1])] as const;
  const piscina = crearPiscina();
  const refraccion = opciones.refraccion !== false;
  let gradientes: Gradientes | null = null;
  let ctxGradientes: CanvasRenderingContext2D | null = null;
  let fuente: FuenteFondo | null = null;

  // El cuello en el mundo y el bulbo de abajo: los calcula pintarAgua y los usa pintarGotas.
  const gotas: ContextoGotas = {
    destino: bulbos[1], indice: 1, cx: 0, cy: 0, alfa: 1, reducido: false, alCaer: opciones.alCaerGota,
  };

  // "Reducir movimiento" del sistema: menos gotas.
  const consulta = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const alCambiarMovimiento = () => { gotas.reducido = !!consulta?.matches; };
  alCambiarMovimiento();
  consulta?.addEventListener('change', alCambiarMovimiento);

  // Si nos pasan una foto aún sin cargar, la preparamos en cuanto llegue.
  const alCargarFoto = () => { if (fuente) prepararFoto(copias, fuente); };

  return {
    redimensionar(ancho, alto) {
      redimensionarCopias(copias, ancho, alto);
      if (fuente) prepararFoto(copias, fuente);
    },

    actualizarFondo(nueva) {
      if (nueva !== fuente) {
        fuente?.removeEventListener('load', alCargarFoto);
        fuente = nueva;
        copias.listo = false;
        nueva.addEventListener('load', alCargarFoto);
        prepararFoto(copias, nueva);
      }
      sincronizarEncaje(copias, nueva);
      if (!copias.listo) prepararFoto(copias, nueva);
    },

    pintarAgua(ctx, estado: EstadoAgua) {
      if (ctx !== ctxGradientes) { gradientes = crearGradientes(ctx); ctxGradientes = ctx; }
      const m = estado.matriz;
      prepararBulbo(bulbos[0], m, estado.bulbos[0]);
      prepararBulbo(bulbos[1], m, estado.bulbos[1]);

      const alfa = estado.opacidad <= 0 ? 0 : estado.opacidad >= 1 ? 1 : estado.opacidad;
      const mezcla = Math.min(1, Math.max(0, estado.desenfoque / DESENFOQUE_MAX));
      if (alfa > 0) {
        pintarBulbo(ctx, bulbos[0], estado.bulbos[0].alturas, copias, gradientes!, mezcla, alfa, refraccion);
        pintarBulbo(ctx, bulbos[1], estado.bulbos[1].alturas, copias, gradientes!, mezcla, alfa, refraccion);
      }

      // Para las gotas: cuello en el mundo y bulbo que queda abajo (gravedad del mundo).
      const { x, y } = opciones.cuello;
      gotas.cx = m.a * x + m.c * y + m.e;
      gotas.cy = m.b * x + m.d * y + m.f;
      const abajo = bulbos[0].yMin + bulbos[0].yMax > bulbos[1].yMin + bulbos[1].yMax ? 0 : 1;
      gotas.destino = bulbos[abajo];
      gotas.indice = abajo;
      gotas.alfa = alfa;
    },

    pintarGotas(ctx, estado: EstadoGotas) {
      if (!gradientes) return; // pintarAgua aún no ha corrido
      moverYPintarGotas(ctx, piscina, gotas, gotas.alfa > 0 ? estado.caudal : 0, estado.dt, gradientes);
    },

    destruir() {
      consulta?.removeEventListener('change', alCambiarMovimiento);
      fuente?.removeEventListener('load', alCargarFoto);
      fuente = null;
      copias.bajo.width = copias.bajo.height = 0;
      copias.muyBajo.width = copias.muyBajo.height = 0;
      for (const b of bulbos) b.capa.width = b.capa.height = 0;
      copias.listo = false;
    },
  };
}
