/**
 * Google Analytics 4 solo entra en la página después de aceptarlo.
 * Un id vacío o de ejemplo no carga nada. Retirar el consentimiento
 * borra las cookies `_ga*`, deja el modo de consentimiento en denied
 * y corta `/g/collect`.
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

/**
 * Dominios al caducar cookies de GA.
 * El host, `.host` y, si hay subdominio, el apex (en producción,
 * `.sebastianzaruha.com` y `sebastianzaruha.com`) para restos de pruebas
 * con el `auto` de gtag, que escribe en el eTLD+1.
 */
export function gaCookieClearDomains(hostname: string): readonly string[] {
  const host = hostname.trim().toLowerCase();
  const domains = new Set<string>(['']);
  if (!host) return [...domains];
  domains.add(host);
  if (host.startsWith('www.')) domains.add(host.slice(4));
  else domains.add(`.${host}`);
  const labels = host.split('.').filter(Boolean);
  const ip = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':');
  if (!ip && labels.length >= 3) {
    for (let i = 1; i <= labels.length - 2; i += 1) {
      const parent = labels.slice(i).join('.');
      domains.add(parent);
      domains.add(`.${parent}`);
    }
  }
  return [...domains];
}

/** Rutas al caducar: `/` y cada tramo de la ruta actual, con y sin barra final. */
export function gaCookieClearPaths(pathname: string): readonly string[] {
  const paths = new Set<string>(['/']);
  const clean = (pathname.split('?')[0] ?? '/').split('#')[0] ?? '/';
  const normalized = clean.startsWith('/') ? clean : `/${clean}`;
  let acc = '';
  for (const bit of normalized.split('/').filter(Boolean)) {
    acc += `/${bit}`;
    paths.add(acc);
    paths.add(`${acc}/`);
  }
  return [...paths];
}

function nombresGa(measurementId?: string | null): string[] {
  const names = new Set<string>(['_ga', '_gid', '_gat']);
  if (measurementId?.startsWith('G-')) names.add(`_ga_${measurementId.slice(2)}`);
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim() ?? '';
    if (name.startsWith('_ga') || name.startsWith('_gid') || name.startsWith('_gat')) names.add(name);
  }
  return [...names];
}

/** Borra `_ga*`, `_gid` y `_gat*` en cada dominio y cada ruta. */
export function deleteGaCookies(measurementId?: string | null): void {
  const paths = gaCookieClearPaths(location.pathname || '/');
  const domains = gaCookieClearDomains(location.hostname || '');
  const secure = location.protocol === 'https:' ? [false, true] : [false];
  for (const name of nombresGa(measurementId)) {
    for (const domain of domains) {
      const domainAttr = domain ? `; domain=${domain}` : '';
      for (const path of paths) {
        for (const isSecure of secure) {
          const secureAttr = isSecure ? '; Secure' : '';
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domainAttr}${secureAttr}`;
        }
      }
    }
  }
}

let loadedId: string | null = null;
let scriptActivo = false;
let quitarBloqueo: (() => void) | null = null;

function esCollect(url: string): boolean {
  return /\/g\/collect(?:[?#]|$)/.test(url) || /\/j\/collect(?:[?#]|$)/.test(url);
}

function urlDe(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Impide hits a /g/collect aunque gtag.js ya estuviera en marcha. */
function bloquearCollect(): void {
  if (quitarBloqueo) return;
  const w = window as Window & {
    fetch?: typeof fetch;
    XMLHttpRequest?: typeof XMLHttpRequest;
  };
  const pasos: Array<() => void> = [];
  if (typeof w.fetch === 'function') {
    const original = w.fetch.bind(w);
    w.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (esCollect(urlDe(input))) return Promise.resolve(new Response(null, { status: 204 }));
      return original(input, init);
    };
    pasos.push(() => {
      w.fetch = original;
    });
  }
  const nav = w.navigator;
  if (nav && typeof nav.sendBeacon === 'function') {
    const original = nav.sendBeacon.bind(nav);
    nav.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (esCollect(String(url))) return true;
      return original(url, data);
    };
    pasos.push(() => {
      nav.sendBeacon = original;
    });
  }
  const XHR = w.XMLHttpRequest;
  if (XHR) {
    const proto = XHR.prototype;
    const originalOpen = proto.open;
    const originalSend = proto.send;
    proto.open = function open(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      (this as XMLHttpRequest & { __hg?: string }).__hg = String(url);
      return originalOpen.call(this, method, url, async ?? true, username, password);
    } as typeof proto.open;
    proto.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      const url = (this as XMLHttpRequest & { __hg?: string }).__hg ?? '';
      if (esCollect(url)) return;
      return originalSend.call(this, body);
    } as typeof proto.send;
    pasos.push(() => {
      proto.open = originalOpen;
      proto.send = originalSend;
    });
  }
  quitarBloqueo = () => {
    for (const paso of pasos) paso();
    quitarBloqueo = null;
  };
}

function permitirCollect(): void {
  quitarBloqueo?.();
}

function marcarScriptActivo(): void {
  scriptActivo = true;
}

/**
 * Inserta gtag. No hace nada si no hay un id real o si ya está el mismo.
 *
 * gtag.js solo ejecuta `js` / `config` / `event` si la entrada del dataLayer
 * es un objeto Arguments (`function gtag(){ dataLayer.push(arguments); }`).
 * Un rest (`...args`) empuja un Array: el script carga con 200 y no hay
 * ningún hit a /g/collect. Esta función clásica se mantiene así tras el
 * minify de Vite (esbuild y oxc). `cookie_domain: 'none'` deja la cookie
 * solo en el host actual (sin Domain); `auto` la subiría al apex.
 */
export function enableGoogleAnalytics(id: string | null): void {
  if (!id) return;
  permitirCollect();
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
  window.gtag('config', id, { cookie_domain: 'none' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `${GA_HOST}?id=${encodeURIComponent(id)}`;
  script.dataset.hourglassGa = id;
  script.onload = marcarScriptActivo;
  document.head.appendChild(script);
}

/**
 * Apaga GA: consentimiento denied, sin script y sin /g/collect.
 * Borra las cookies en todas las variantes de dominio y ruta.
 */
export function disableGoogleAnalytics(id: string | null): void {
  if (id) (window as unknown as Record<string, boolean>)[disableFlag(id)] = true;
  bloquearCollect();
  if (scriptActivo && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }
  deleteGaCookies(id);
  document.querySelectorAll('script[data-hourglass-ga]').forEach((node) => node.remove());
  document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').forEach((node) => node.remove());
  const w = window as Window & { google_tag_manager?: unknown; google_tag_data?: unknown };
  delete w.google_tag_manager;
  delete w.google_tag_data;
  scriptActivo = false;
  loadedId = null;
  window.gtag = function gtagSilencio() {
    /* Consentimiento retirado: no se encola ni se envía. */
  };
}
