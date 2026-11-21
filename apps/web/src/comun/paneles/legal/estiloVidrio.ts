/**
 * El aviso legal encima del vidrio: sin fondo propio y con la tinta del vidrio
 * (blanco en oscuro, la tinta de la escena en claro), que se lee del propio <iframe>
 * porque hereda las variables --vl-* de la hoja.
 */
export function estiloVidrio(frame: HTMLIFrameElement): string {
  const cs = getComputedStyle(frame);
  const v = (nombre: string, si: string) => cs.getPropertyValue(nombre).trim() || si;
  const texto = v('--vl-texto', '#fff');
  const texto2 = v('--vl-texto-2', 'rgba(255,255,255,.92)');
  const linea = v('--vl-linea', 'rgba(255,255,255,.45)');
  const relleno = v('--vl-relleno', 'rgba(255,255,255,.08)');
  const sombra = v('--vl-sombra-texto', 'none');
  // El esquema de color del iframe tiene que ser el mismo que el de su <iframe> en la app:
  // si no coinciden, el navegador pinta el fondo del iframe opaco (negro o blanco) y tapa el vidrio.
  const esquema = cs.colorScheme || 'normal';
  return `
:root,:root:root{color-scheme:${esquema}!important;--fg:${texto};--muted:${texto2};--line:${linea};--link:${texto};--card:transparent;--bg:transparent}
html,body{background:transparent!important}
body{color:${texto};text-shadow:${sombra}}
.card{background:transparent!important;border-color:transparent!important}
a{color:${texto};text-decoration-color:${linea};text-underline-offset:.15em}
strong,h1,h2{color:${texto}}
h2{border-top-color:${linea}!important}
table,th,td{background:transparent!important;color:inherit!important;border-color:${linea}!important}
th{font-weight:600}
.lang{color:${texto};font-weight:500}
.leave{background:${relleno}!important;border-color:${linea}!important;color:${texto}!important}
`;
}
