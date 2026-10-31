/**
 * Vercel Web Analytics solo entra tras Aceptar (el componente React).
 * Al rechazar o retirar, se quita el script y se anulan envíos ya en cola.
 */

type VaWindow = Window & {
  va?: (event: 'beforeSend' | 'event' | 'pageview', data?: unknown) => void;
  vaq?: [string, unknown?][];
};

const SCRIPT_SELECTOR = [
  'script[src*="/_vercel/insights/"]',
  'script[src*="va.vercel-scripts.com"]',
  'script[data-sdkn^="@vercel/analytics"]',
].join(', ');

/** Deja de medir. Un `beforeSend` que devuelve null cancela el hit. */
export function stopVercelWebAnalytics(): void {
  const block = () => null;
  const w = window as VaWindow;
  if (typeof w.va === 'function') w.va('beforeSend', block);
  else {
    w.vaq = [['beforeSend', block]];
    w.va = (event, data) => {
      if (event !== 'beforeSend') return;
      w.vaq = w.vaq ?? [];
      w.vaq.push([event, data]);
    };
  }
  document.querySelectorAll(SCRIPT_SELECTOR).forEach((node) => node.remove());
}
