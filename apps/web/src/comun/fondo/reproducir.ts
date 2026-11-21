/**
 * El autoplay de un vídeo sin sonido solo arranca si `muted` es la
 * propiedad del elemento. El atributo de React llega tarde, el navegador
 * rechaza `play()` y, si ese rechazo desmonta el vídeo, se queda el póster.
 */

export function silenciar(video: HTMLVideoElement): void {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
}

/** Safari no decodifica el VP9. El resto sí, y el MP4 queda de reserva. */
export function fuenteDeVideo(webm: string, mp4: string): string {
  const sonda = document.createElement('video');
  return sonda.canPlayType('video/webm; codecs="vp9"') === '' ? mp4 : webm;
}

/**
 * Pide play() al montar, cuando hay fotograma y cuando la capa pasa a verse.
 * Un rechazo no es un fallo del archivo: se reintenta. El gesto tapa el
 * caso de iOS, que a veces ignora el autoplay mudo hasta el primer toque.
 */
export function engancharReproduccion(video: HTMLVideoElement): () => void {
  silenciar(video);
  let vivo = true;
  let reintentos = 0;
  let timer = 0;

  const jugar = () => {
    if (!vivo) return;
    silenciar(video);
    if (document.hidden) {
      video.pause();
      return;
    }
    const hecho = video.play();
    if (!hecho) return;
    void hecho.then(
      () => {
        reintentos = 0;
      },
      () => {
        if (!vivo || reintentos > 6) return;
        reintentos += 1;
        timer = window.setTimeout(jugar, 160 * reintentos);
      },
    );
  };

  const alVer = () => jugar();
  const alGesto = () => jugar();
  video.addEventListener('canplay', jugar);
  video.addEventListener('loadeddata', jugar);
  document.addEventListener('visibilitychange', alVer);
  document.addEventListener('pointerdown', alGesto, { once: true });

  const capa = video.closest('.fondo-capa');
  const obs =
    capa instanceof HTMLElement
      ? new MutationObserver(() => {
          if (capa.classList.contains('se-ve')) jugar();
        })
      : null;
  obs?.observe(capa instanceof HTMLElement ? capa : video, { attributes: true, attributeFilter: ['class'] });

  if (video.readyState >= 2) jugar();
  else video.load();

  return () => {
    vivo = false;
    window.clearTimeout(timer);
    video.removeEventListener('canplay', jugar);
    video.removeEventListener('loadeddata', jugar);
    document.removeEventListener('visibilitychange', alVer);
    document.removeEventListener('pointerdown', alGesto);
    obs?.disconnect();
    video.pause();
  };
}
