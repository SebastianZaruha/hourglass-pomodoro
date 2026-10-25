# Banner de cookies — copy primera capa (Hourglass Pomodoro)

_Fuente: Abogado, 25 oct 2026. Para la futura implementación web._

## ES
> Usamos cookies técnicas necesarias y, solo si aceptas, cookies de analítica de Google Analytics para saber cómo se usa la web. Vercel Web Analytics mide visitas sin cookies. Puedes cambiar tu elección cuando quieras en «Configurar cookies».

Botones: **Aceptar** | **Rechazar** | **Configurar** (→ `cookies.html`)

## EN
> We use strictly necessary cookies and, only if you accept, Google Analytics cookies to understand how the site is used. Vercel Web Analytics measures visits without cookies. You can change your choice at any time in “Cookie settings”.

Buttons: **Accept** | **Reject** | **Configure** (→ `cookies-en.html`)

## Notas de implementación
- **No cargar `gtag` / GA4 hasta que el usuario pulse Aceptar.**
- **Rechazar = sin GA** (no se carga ningún script ni cookie de Google).
- Aceptar y Rechazar con el mismo peso visual; sin casillas premarcadas.
- Guardar la elección en `localStorage` (con fecha) y volver a preguntar como máximo a los **~12 meses**.
- Enlace «Configurar cookies» / “Cookie settings” en el pie (`#configure-cookies`) reabre el banner y permite retirar el consentimiento (borrar cookies `_ga*` al retirar).
- Vercel Web Analytics puede cargarse siempre (sin cookies, interés legítimo).
