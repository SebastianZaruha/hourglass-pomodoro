import { useEffect, useRef } from 'react';

import { useHojaVidrio } from '../../estilo/vidrio-liquido';
import { apartarSecciones, estiloVidrio } from './estiloVidrio';

interface Props {
  readonly src: string;
  readonly title: string;
  readonly onClose: () => void;
  readonly onConfigure: () => void;
}

/**
 * El HTML legal sigue en `public/` para un enlace directo. Aquí va en un
 * iframe para que el temporizador no se desmonte.
 */
export function LegalOverlay({ src, title, onClose, onConfigure }: Props) {
  const hoja = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  useHojaVidrio(hoja);
  const closeRef = useRef(onClose);
  const configureRef = useRef(onConfigure);
  closeRef.current = onClose;
  configureRef.current = onConfigure;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onLoad = () =>
      bindLegalFrame(
        frame,
        () => closeRef.current(),
        () => configureRef.current(),
      );
    frame.addEventListener('load', onLoad);
    if (
      frame.contentDocument?.readyState === 'complete' &&
      frame.contentWindow?.location.href !== 'about:blank'
    ) {
      onLoad();
    }
    return () => frame.removeEventListener('load', onLoad);
  }, [src]);

  return (
    <div
      className="legal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={hoja} className="legal-dialog hoja vidrio vidrio-liquido" role="dialog" aria-modal="true" aria-label={title}>
        <iframe ref={frameRef} src={src} title={title} />
      </div>
    </div>
  );
}

function isElement(node: EventTarget | null): node is Element {
  return !!node && typeof (node as Element).closest === 'function';
}

function bindLegalFrame(frame: HTMLIFrameElement, onClose: () => void, onConfigure: () => void) {
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win || win.location.href === 'about:blank') return;
  const path = win.location.pathname;
  if (path === '/' || path === '') {
    const params = new URLSearchParams(win.location.search);
    const configure = params.get('configure-cookies') === '1' || win.location.hash === '#configure-cookies';
    onClose();
    if (configure) onConfigure();
    return;
  }
  if (doc.documentElement.dataset.legalBound === '1') return;
  doc.documentElement.dataset.legalBound = '1';
  // El aviso trae su propio fondo opaco y sus colores (que siguen el tema del SISTEMA,
  // no el de la app). Dentro de la hoja se quita el fondo para que se vea el vidrio
  // líquido, el texto va en blanco y cada apartado en su tarjeta (ver estiloVidrio).
  const estilo = doc.createElement('style');
  estilo.textContent = estiloVidrio(frame);
  doc.head.append(estilo);
  apartarSecciones(doc);

  doc.addEventListener(
    'click',
    (event) => {
      if (!isElement(event.target)) return;
      const anchor = event.target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href') || '';
        if (href === '#configure-cookies') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          onConfigure();
          return;
        }
        let url: URL;
        try {
          url = new URL(anchor.href, win.location.href);
        } catch {
          return;
        }
        if (url.origin !== win.location.origin) {
          event.preventDefault();
          event.stopPropagation();
          window.open(url.href, '_blank', 'noopener,noreferrer');
          return;
        }
        if (url.pathname === '/' || url.pathname === '') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        return;
      }
      if (event.target.closest('#leave-page, .leave')) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (!event.target.closest('button, .card, footer')) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    },
    true,
  );

  doc.addEventListener(
    'keydown',
    (event) => {
      if (!('key' in event) || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    },
    true,
  );
}
