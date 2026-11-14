## Reglas obligatorias (añadir al principio de AGENTS.md)

1. **Bien a la primera.** Antes de tocar código, entiende el sistema entero (giro, física, carga, escenas, menú) y elige la mejor solución, no un parche. Nada de ir probando.
2. **FIJADO.md es ley.** En apps/web hay una lista de cada comportamiento ya arreglado, en una línea cada uno. Nada de esa lista se puede romper. Antes de cada push la repasas a mano en el build de producción, con rueda, arrastre y doble clic de verdad.
3. **No se escriben tests nuevos.** Nada de tests de colores ni de cosas visuales. Los pocos que ya existen (solapes, física) siguen como están.
4. **Nada de "arreglado" sin haberlo visto.** El informe enseña cada punto con recortes 1:1 del build real. Si algo no se ha conseguido, se dice claro.
5. **Si un arreglo toca algo que no era el objetivo**, se para y se avisa.
6. **No hay vueltas por iniciativa propia.** Si el CI falla, solo se arregla ese fallo.
7. **Sin merge, sin publicar y sin esperar al CI.**
8. **Un commit por fallo.** Si una vuelta rompe algo que ya funcionaba, se revierte ese commit; no se arregla el arreglo.

## Reglas de importación (c.4)

1. `comun/**` no importa nada de `escenas/**` ni de `app/**`.
2. `escenas/X/**` importa solo de `comun/**` (por su `index.ts`) y de `@reloj/core`. Excepción: `escenas/arena/` y `escenas/clasico/` importan `escenas/arena-modelo`.
3. `escenas/lluvia/**` nunca importa `escenas/arena-modelo/**` ni `SandSimulation`, `StreamParticles` o `sandLevelForDuration`.
4. Solo `app/` importa `escenas/*` (y solo su `index.ts`).
5. Fuera de cada carpeta solo se importa su `index.ts`. Nada de `comun/frasco/geometria` desde fuera, sino `comun/frasco`.
6. Nadie fuera de `comun/giro` escribe el ángulo. La nube no recibe ángulo ni transformación, solo la `opacidad`.
7. Fuera de `escenas/*/index.ts` no hay `if (escena === 'lluvia')` ni `dark ? … : …`. Lo que cambia entre escenas es un dato del `Aspecto`.

`scripts/comprobar-imports.mjs` recorre los `import` y aplica las reglas 1-5 y 7. Corre dentro de `npm run build`, antes de `tsc`. No es un test: no comprueba qué hace la app, solo que las puertas siguen cerradas.
