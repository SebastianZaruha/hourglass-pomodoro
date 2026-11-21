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

/**
 * Dos copias del mismo plano. Cerca del corte, la que espera arranca desde
 * el principio y se cruza con la que acaba. El corte de un bucle corto no se ve.
 * `data-fuente` marca cuál está más visible, para el fondo del vidrio.
 */
export function engancharFundido(primero: HTMLVideoElement, segundo: HTMLVideoElement): () => void {
  const soltarPrimero = engancharReproduccion(primero);
  const soltarSegundo = engancharReproduccion(segundo);
  segundo.pause();
  let vivo = true;
  let raf = 0;
  let principal = primero;
  let reserva = segundo;

  const cuadro = () => {
    if (!vivo) return;
    const duracion = principal.duration;
    if (duracion > 0 && Number.isFinite(duracion)) {
      const queda = duracion - principal.currentTime;
      const cruce = Math.min(0.45, Math.max(0.18, duracion * 0.22));
      if (queda < cruce) {
        if (reserva.paused || reserva.ended) {
          reserva.currentTime = 0;
          silenciar(reserva);
          void reserva.play();
        }
        const t = Math.min(1, Math.max(0, 1 - queda / cruce));
        principal.style.opacity = String(1 - t);
        reserva.style.opacity = String(t);
        principal.dataset.fuente = t > 0.5 ? '0' : '1';
        reserva.dataset.fuente = t > 0.5 ? '1' : '0';
      } else {
        principal.style.opacity = '1';
        reserva.style.opacity = '0';
        principal.dataset.fuente = '1';
        reserva.dataset.fuente = '0';
      }
      if (principal.ended || queda < 0.03) {
        const sale = principal;
        principal = reserva;
        reserva = sale;
        reserva.pause();
        principal.style.opacity = '1';
        principal.dataset.fuente = '1';
      }
    }
    raf = requestAnimationFrame(cuadro);
  };
  raf = requestAnimationFrame(cuadro);

  return () => {
    vivo = false;
    cancelAnimationFrame(raf);
    soltarPrimero();
    soltarSegundo();
  };
}
