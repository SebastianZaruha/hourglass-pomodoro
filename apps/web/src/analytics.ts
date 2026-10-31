/**
 * Google Analytics 4 solo entra en la página después de Aceptar.
 * Un id vacío o de ejemplo no carga nada.
 */

const GA_HOST = 'https://www.googletagmanager.com/gtag/js';

export function gaMeasurementId(raw = import.meta.env.VITE_GA_MEASUREMENT_ID): string | null {
  const id = raw?.trim() ?? '';
  if (!/^G-[A-Z0-9]+$/i.test(id)) return null;
  if (/x{4,}/i.test(id)) return null;
  return id;
}

function disableFlag(id: string): string {
  return `ga-disable-${id}`;
}

/** Borra cookies de Google Analytics en este sitio. */
export function deleteGaCookies(): void {
  const names = document.cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim() ?? '')
    .filter((name) => name === '_gid' || name === '_gat' || name.startsWith('_ga'));
  const host = location.hostname;
  const domains = ['', host, host.startsWith('www.') ? host.slice(4) : `.${host}`];
  for (const name of names) {
    for (const domain of domains) {
      const domainAttr = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`;
    }
  }
}

let loadedId: string | null = null;

/**
 * Inserta gtag. No hace nada si no hay un id real o si ya está el mismo.
 *
 * gtag.js solo ejecuta `js` / `config` / `event` si la entrada del dataLayer
 * es un objeto Arguments (`function gtag(){ dataLayer.push(arguments); }`).
 * Un rest (`...args`) empuja un Array: el script carga con 200 y no hay
 * ningún hit a /g/collect. Esta función clásica se mantiene así tras el
 * minify de Vite (esbuild y oxc); no hace falta `anonymize_ip` en GA4
 * (la IP ya no se guarda).
 */
export function enableGoogleAnalytics(id: string | null): void {
  if (!id) return;
  (window as unknown as Record<string, boolean>)[disableFlag(id)] = false;
  if (loadedId === id) return;
  loadedId = id;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js exige Arguments. Un rest Array no cuenta como comando.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);
  const script = document.createElement('script');
  script.async = true;
  script.src = `${GA_HOST}?id=${encodeURIComponent(id)}`;
  script.dataset.hourglassGa = id;
  document.head.appendChild(script);
}

/** Apaga GA y quita sus cookies. No vuelve a cargar el script en esta visita. */
export function disableGoogleAnalytics(id: string | null): void {
  if (id) (window as unknown as Record<string, boolean>)[disableFlag(id)] = true;
  deleteGaCookies();
  document.querySelectorAll('script[data-hourglass-ga]').forEach((node) => node.remove());
  loadedId = null;
}
