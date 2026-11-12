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

## Tests

`npm run test --workspace @reloj/web`: 20 pruebas (nivel, agua, volteo, layout, clic, temas, consentimiento).

## Capturas

`/opt/cursor/artifacts/capturas/` — tema × modo a 1440 y 390, más menú, pausa, legal y volteo.
