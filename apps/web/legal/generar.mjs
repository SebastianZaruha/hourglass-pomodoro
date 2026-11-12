/**
 * Genera las páginas legales de public/ a partir de un texto por idioma
 * y una sola plantilla. Las URL no cambian: la app móvil las enlaza.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(raiz, 'public');
const textos = path.join(raiz, 'legal', 'textos');

const PAGINAS = [
  'aviso-legal.html',
  'legal-notice.html',
  'privacidad.html',
  'privacy.html',
  'cookies.html',
  'cookies-en.html',
  'privacidad-app.html',
  'privacy-app.html',
  'app-movil.html',
  'mobile-app.html',
];

function extraer(html) {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  const lang = html.match(/<html lang="([^"]+)"/)?.[1] ?? 'es';
  const langNav = html.match(/<p class="lang">([\s\S]*?)<\/p>/)?.[1]?.trim() ?? '';
  const card = html.match(/<div class="card">([\s\S]*?)<\/div>\s*<footer/)?.[1]?.trim() ?? '';
  const footer = html.match(/<footer class="links">([\s\S]*?)<\/footer>/)?.[1]?.trim() ?? '';
  const close = lang === 'en' ? 'Close' : 'Cerrar';
  return { title, description, lang, langNav, card, footer, close };
}

function plantilla(pagina) {
  return `<!doctype html>
<html lang="${pagina.lang}">
  <head>
    <meta charset="utf-8" />
    <title>${pagina.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${pagina.description}" />
    <link rel="stylesheet" href="/legal.css" />
  </head>
  <body>
    <button type="button" class="leave" id="leave-page">${pagina.close}</button>
    <main>
      <p class="lang">${pagina.langNav}</p>
      <div class="card">
        ${pagina.card}
      </div>
      <footer class="links">${pagina.footer}</footer>
    </main>
    <script src="/legal.js"></script>
  </body>
</html>
`;
}

mkdirSync(textos, { recursive: true });
for (const nombre of PAGINAS) {
  const origen = readFileSync(path.join(pub, nombre), 'utf8');
  const pagina = extraer(origen);
  if (!pagina.card) throw new Error(`Sin texto en ${nombre}`);
  writeFileSync(path.join(textos, nombre), JSON.stringify(pagina, null, 2));
  writeFileSync(path.join(pub, nombre), plantilla(pagina));
}
console.log(`Generadas ${PAGINAS.length} páginas.`);
