/**
 * El aviso legal encima del vidrio liso: sin fondo propio y texto blanco puro.
 * Cada apartado (el título y cada «N. …» con lo que le sigue) va en su propia tarjeta de
 * humo suave, separadas por huecos por donde se ve el vidrio (ver apartarSecciones).
 * Los valores se leen del propio <iframe>, que hereda las variables --vl-* de la hoja.
 */
export function estiloVidrio(frame: HTMLIFrameElement): string {
  const cs = getComputedStyle(frame);
  const v = (nombre: string, si: string) => cs.getPropertyValue(nombre).trim() || si;
  const texto = v('--vl-texto', '#fff');
  const linea = v('--vl-linea', 'rgba(255,255,255,.22)');
  const humo = v('--vl-humo', 'rgba(0,0,0,.08)'); // botones
  const humoTexto = v('--vl-humo-texto', 'rgba(0,0,0,.06)'); // tarjetas de texto
  const sombra = v('--vl-sombra-texto', 'none');
  // El esquema de color del iframe tiene que ser el mismo que el de su <iframe> en la app:
  // si no coinciden, el navegador pinta el fondo del iframe opaco (negro o blanco) y tapa el vidrio.
  const esquema = cs.colorScheme || 'normal';
  return `
:root,:root:root{color-scheme:${esquema}!important;--fg:${texto};--muted:${texto};--line:${linea};--link:${texto};--card:transparent;--bg:transparent}
html,body{background:transparent!important}
body{color:${texto};text-shadow:${sombra}}
.card{background:none!important;border:0!important;box-shadow:none!important;padding:0!important}
.vl-apartado{background:${humoTexto};border-radius:16px;padding:1rem 1.25rem;margin:0 0 14px;box-shadow:0 0 8px 2px ${humoTexto}}
.vl-apartado>:first-child{margin-top:0!important}
.vl-apartado>:last-child{margin-bottom:0!important}
.vl-apartado h2{border-top:0!important;padding-top:0!important;margin-top:0!important}
.vl-apartado p:empty{display:none}
a{color:${texto};text-decoration-color:${linea};text-underline-offset:.15em}
strong,h1,h2,p,li,small{color:${texto}}
table,th,td{background:transparent!important;color:inherit!important;border-color:${linea}!important}
th{font-weight:600}
.lang{color:${texto};font-weight:500;background:${humo};border:0;box-shadow:none;border-radius:999px;padding:0 .9rem;width:max-content}
.leave{background:${humo}!important;border-color:transparent!important;box-shadow:none!important;color:${texto}!important}
`;
}

/**
 * Parte el bloque único del aviso (.card) en tarjetas: una por apartado.
 * El HTML legal no trae <section>, así que se agrupa cada h2 con lo que le sigue
 * hasta el siguiente h2; lo que va antes del primero (el h1) es la primera tarjeta.
 */
export function apartarSecciones(doc: Document): void {
  const card = doc.querySelector('.card');
  if (!card || card.querySelector('.vl-apartado')) return;
  let actual: HTMLElement | null = null;
  for (const hijo of Array.from(card.children)) {
    if (!actual || hijo.tagName === 'H1' || hijo.tagName === 'H2') {
      actual = doc.createElement('section');
      actual.className = 'vl-apartado';
      card.insertBefore(actual, hijo);
    }
    actual.append(hijo);
  }
}
