import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';

interface Props {
  readonly src: string;
  readonly title: string;
  readonly onClose: () => void;
  readonly onConfigure: () => void;
}

/** Clic normal: el aviso se abre encima. Ctrl/cmd o botón central siguen el enlace. */
export function keepAppOnLegalClick(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  event.preventDefault();
  return true;
}

/**
 * El HTML legal sigue en `public/` para un enlace directo. Aquí va en un
 * iframe para que el temporizador no se desmonte.
 */
export function LegalOverlay({ src, title, onClose, onConfigure }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
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
      <div className="legal-dialog" role="dialog" aria-modal="true" aria-label={title}>
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
