# Progreso — web de escenas

Rama `feature/web-escenas`, salida de `main`. No se fusiona ni se publica: la vista previa de Vercel basta hasta que Sebastián lo apruebe.

## Fase 0

- `esbuild` en las devDependencies de `apps/web`.
- Interfaz solo en español. Legales bilingües.
- Fuera `documentTitle`, `allowAnalyticsEvent` y el botón de idioma.

## Fases 1 a 6

- `calcularLayout` no depende del tema. El reloj va arriba a la derecha en ancho y debajo del frasco en estrecho. El menú estrecho se superpone sin mover el frasco.
- Temas Lluvia, Arena y Clásico, cada uno con luz propia. Clásico oscuro copia los colores de `main`. Sin miel ni nieve.
- El nivel de arena y de agua sale del tiempo (`nivelDesdeTiempo`). El volteo lo cierra un muelle y el ángulo vuelve a 0 en el mismo paso.
- Arena con `SandSimulation` del core. Agua con una recta perpendicular a la gravedad.
- Fondos: foto o vídeo con póster (reducir movimiento, ahorro de datos o fallo). Nube recortada del vídeo sobre claro.
- Menú opaco, tooltips con `aria-label`, pausa a pantalla completa y páginas legales generadas desde un texto por idioma.

## Ronda de revisión

- El agua es casi transparente: se ve el fondo, se oscurece hacia abajo y lleva menisco. Sin textura de cáusticas.
- Brillo, reflejo, tinte y sombra salen de la luz de cada tema y modo. Esa misma luz tiñe la arena.
- El menú es vidrio esmerilado: blanco neutro en claro, casi negro en oscuro, el mismo en los tres temas.
- Clásico usa el estudio (WebP, AVIF y JPG). El frasco no cambia de sitio. El reloj sigue arriba a la derecha en todos los temas.
- En estrecho el pie cabe en una línea y no pisa el reloj. La nube se sienta en el cristal. Los granos se dibujan al tamaño del frasco.

## Tests

`npm run test --workspace @reloj/web`: 21 pruebas (nivel, agua, volteo, layout, clic, temas, consentimiento).

## Capturas

`/opt/cursor/artifacts/capturas/` — tema × modo a 1440, 390 y 360, más menú, pausa, legal y volteo.
