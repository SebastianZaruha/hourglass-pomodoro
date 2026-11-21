import { useEffect, useRef } from 'react';

import type { Aspecto } from '../frasco';
import { ahorraDatos, type Caja } from '../fondo';
import type { Puente3D } from './puente';
import type { Fondo, Frasco3D, Modo } from './tipos';
import './frasco-3d.css';

const MASCARA = '/frasco/jar-mask.webp';
/**
 * La intro espera al 3D. Si en este tiempo no pinta, se queda el frasco de foto
 * para toda la visita: así nunca hay un relevo de uno a otro a la vista.
 */
const ESPERA_3D = 4000;

interface Props {
  readonly aspecto: Aspecto;
  readonly modo: Modo;
  /** La de useCajaFrasco, en px de documento. */
  readonly caja: Caja | null;
  readonly puente: Puente3D;
}

/** Sin WebGL no se descarga nada: se queda el frasco de foto. */
function hayWebGL(): boolean {
  try {
    const prueba = document.createElement('canvas');
    const gl = prueba.getContext('webgl2') ?? prueba.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * La foto o el vídeo que ya pinta Fondo: la capa más nueva de la pila.
 * El WebGL usa los mismos elementos, así no se descarga ni decodifica dos veces.
 */
function mediosDelFondo(canvas: HTMLCanvasElement): { fuente: HTMLImageElement | HTMLVideoElement; poster?: HTMLImageElement } | null {
  const pila = canvas.parentElement?.querySelector('.fondo-pila');
  const capas = pila?.querySelectorAll('.fondo-capa');
  const capa = capas && capas.length > 0 ? capas[capas.length - 1] : null;
  if (!capa) return null;
  const videos = capa.querySelectorAll('video.fondo-video');
  let video: Element | null = videos.length > 0 ? videos[0] ?? null : null;
  for (const candidato of videos) {
    if (candidato.getAttribute('data-fuente') === '1') video = candidato;
  }
  const img = capa.querySelector('img.fondo-medio');
  const foto = img instanceof HTMLImageElement ? img : undefined;
  if (video instanceof HTMLVideoElement) return { fuente: video, poster: foto };
  return foto ? { fuente: foto } : null;
}

/**
 * Lienzo WebGL detrás del escenario: el fondo y, cuando Frasco lo pide, el frasco 3D.
 * three llega en diferido. Si falla o se pierde el contexto, el lienzo se quita
 * y Frasco vuelve al vidrio de foto.
 */
export function Capa3D({ aspecto, modo, caja, puente }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<Frasco3D | null>(null);
  const aspectoRef = useRef(aspecto);
  const modoRef = useRef(modo);
  const cajaRef = useRef(caja);
  const aplicarRef = useRef<() => void>(() => {});
  aspectoRef.current = aspecto;
  modoRef.current = modo;
  cajaRef.current = caja;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || ahorraDatos() || !hayWebGL()) {
      puente.estado = 'fallo';
      puente.despertar?.();
      if (canvas) canvas.style.display = 'none';
      return () => {
        puente.estado = 'cargando';
      };
    }
    puente.estado = 'cargando';
    let vivo = true;
    let ultimo: Fondo | null = null;

    const cajaLocal = (): Caja | null => {
      const c = cajaRef.current;
      if (!c) return null;
      const r = canvas.getBoundingClientRect();
      return { x: c.x - r.left, y: c.y - r.top, w: c.w, h: c.h };
    };

    const aplicarFondo = () => {
      const motor = motorRef.current;
      if (!motor) return;
      const medios = mediosDelFondo(canvas);
      if (!medios) return;
      const a = aspectoRef.current;
      const extra = a.frasco3d;
      const f: Fondo = {
        fuente: medios.fuente,
        poster: medios.poster,
        ancla: a.ancla,
        pie: extra?.pie ?? 'base',
        estudio: extra?.estudio,
        tinte: extra?.tinte,
        reserva: a.reserva,
      };
      if (
        ultimo &&
        ultimo.fuente === f.fuente &&
        ultimo.poster === f.poster &&
        ultimo.ancla === f.ancla &&
        ultimo.reserva === f.reserva
      )
        return;
      ultimo = f;
      motor.setFondo(f);
    };
    aplicarRef.current = aplicarFondo;

    const fallar = () => {
      if (!vivo) return;
      vivo = false;
      puente.estado = 'fallo';
      puente.motor = null;
      puente.pantalla = null;
      motorRef.current?.destruir();
      motorRef.current = null;
      canvas.style.display = 'none';
      puente.despertar?.();
    };

    const empezar = () => {
      if (!vivo) return;
      void import('./motor').then(
        ({ crearFrasco3D }) => {
          if (!vivo) return;
          let motor: Frasco3D;
          try {
            motor = crearFrasco3D(canvas, {
              mascara: MASCARA,
              modo: modoRef.current,
              caja: cajaLocal(),
              interaccion: false,
              alListo: () => {
                if (!vivo || puente.estado !== 'cargando') return;
                window.clearTimeout(limite);
                puente.estado = 'listo';
                puente.despertar?.();
              },
            });
          } catch {
            fallar();
            return;
          }
          motor.setFrascoVisible(false);
          motorRef.current = motor;
          puente.motor = motor;
          puente.pantalla = (ctx, angulo) => {
            // En el tipo 'frasco' el ctx llega con S(res) y el origen en cajaFoto.
            // Hito 2: con la intro, el cuello visible se mueve y el frasco escala (escalaDeIntro).
            const { pivote, cajaFoto, pivoteVisible, escala, cajaFondo } = motor.getCaja();
            const r = canvas.getBoundingClientRect();
            const cuello = { x: pivoteVisible.x + r.left, y: pivoteVisible.y + r.top };
            const matriz = DOMMatrix.fromMatrix(ctx.getTransform())
              .translate(pivote.x - cajaFoto.x, pivote.y - cajaFoto.y)
              .rotate((-angulo * 180) / Math.PI)
              .scale(1 / escala)
              .translate(-cuello.x, -cuello.y);
            const fondo = cajaFondo ? { x: cajaFondo.x + r.left, y: cajaFondo.y + r.top, w: cajaFondo.w, h: cajaFondo.h } : undefined;
            return { matriz, cuello, fondo, escala };
          };
          aplicarFondo();
        },
        // Sin el chunk: se queda el frasco de foto.
        () => fallar(),
      );
    };

    const alPerder = (e: Event) => {
      e.preventDefault();
      fallar();
    };
    canvas.addEventListener('webglcontextlost', alPerder);

    const pila = canvas.parentElement?.querySelector('.fondo-pila');
    const obs = new MutationObserver(() => aplicarFondo());
    if (pila) obs.observe(pila, { childList: true, subtree: true });

    // Sin esperar al reposo: la intro (ya en 3D) espera a que esté.
    const limite = window.setTimeout(() => {
      if (puente.estado === 'cargando') fallar();
    }, ESPERA_3D);
    empezar();

    return () => {
      vivo = false;
      obs.disconnect();
      canvas.removeEventListener('webglcontextlost', alPerder);
      window.clearTimeout(limite);
      aplicarRef.current = () => {};
      puente.estado = 'cargando';
      puente.motor = null;
      puente.pantalla = null;
      motorRef.current?.destruir();
      motorRef.current = null;
    };
  }, [puente]);

  useEffect(() => {
    aplicarRef.current();
  }, [aspecto]);

  useEffect(() => {
    motorRef.current?.setModo(modo);
  }, [modo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const motor = motorRef.current;
    if (!canvas || !motor || !caja) return;
    const r = canvas.getBoundingClientRect();
    motor.setCaja({ x: caja.x - r.left, y: caja.y - r.top, w: caja.w, h: caja.h });
  }, [caja]);

  return <canvas ref={canvasRef} className="frasco-3d" aria-hidden="true" />;
}
