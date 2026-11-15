/** Los dos últimos segundos se cruzan con el principio, para que el bucle no salte. */
const CRUCE_S = 2;

interface Par {
  readonly activo: HTMLVideoElement;
  readonly espera: HTMLVideoElement;
}

/**
 * Un vídeo de ~30 s en bucle. El segundo empieza antes de que el primero acabe,
 * así no hay un fotograma negro ni un salto.
 */
export function engancharBucle(a: HTMLVideoElement, b: HTMLVideoElement): () => void {
  let vivo = true;
  let cruzando = false;
  let par: Par = { activo: a, espera: b };
  b.style.opacity = '0';
  a.style.opacity = '1';

  const pedir = (video: HTMLVideoElement, siguiente: () => void) => {
    if (!vivo) return;
    const conMarco = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (typeof conMarco.requestVideoFrameCallback === 'function') conMarco.requestVideoFrameCallback(siguiente);
    else requestAnimationFrame(siguiente);
  };

  const cuadro = () => {
    if (!vivo) return;
    const { activo, espera } = par;
    const duracion = activo.duration;
    if (!(duracion > 0)) {
      pedir(activo, cuadro);
      return;
    }
    const queda = duracion - activo.currentTime;
    if (!cruzando && queda < CRUCE_S && queda > 0) {
      cruzando = true;
      espera.currentTime = 0;
      void espera.play().catch(() => undefined);
    }
    if (cruzando) {
      const t = Math.min(1, Math.max(0, 1 - queda / CRUCE_S));
      activo.style.opacity = String(1 - t);
      espera.style.opacity = String(t);
      if (queda <= 0.05 || activo.ended) {
        espera.style.opacity = '1';
        activo.style.opacity = '0';
        activo.pause();
        par = { activo: espera, espera: activo };
        cruzando = false;
      }
    }
    pedir(par.activo, cuadro);
  };

  void a.play().catch(() => undefined);
  pedir(a, cuadro);
  return () => {
    vivo = false;
    a.pause();
    b.pause();
  };
}
