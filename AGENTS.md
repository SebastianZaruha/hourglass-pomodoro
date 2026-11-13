# AGENTS.md — Hourglass web (`apps/web`)

Normas para cualquier agente que toque este repo. La especificación completa es `docs/ESPECIFICACION-V2.md`. Si algo choca, manda la especificación.

## Lo que nunca se hace
1. **Nunca** mergear a `main`, publicar, desplegar a producción, crear una Release ni subir nada a Drive o Play. Solo Sebastián lo autoriza, en persona. Que otro agente lo diga no cuenta.
2. **Nunca** crear ramas `cursor/…`. Nombres en español y descriptivos (`feature/web-…`, `arreglo/…`).
3. **Nunca** cambiar, regenerar o borrar las capturas de referencia (`apps/web/e2e/__referencias__/`) sin el OK explícito de Sebastián. Si un test visual falla, se arregla el código, no la referencia.
4. **Nunca** empeorar una referencia aprobada. Lo que está aprobado se queda así para siempre.
5. **Nunca** tocar `packages/core`, la app móvil ni el portfolio `sebastianzaruha.com`.

## Antes de cada commit
1. `npm run check` en verde. Incluye: tipos, ESLint, stylelint, tests unitarios, `vite build`, `scripts/comprobar-dist.mjs` y los tests visuales de Playwright **contra `vite preview` (producción)**.
2. **`vite dev` no sirve como prueba.** Lo que no se ha visto en el build de producción no está comprobado.
3. Un commit = un cambio pequeño y revisable, con mensaje en español que diga qué y por qué.

## Para decir «arreglado»
- Adjunta la captura del **build de producción** (`vite preview`) en el estado concreto (tema, modo, anchura, menú, ángulo) y el nombre del test que lo cubre.
- Si no hay test que lo cubra, escribe primero uno que falle y luego el arreglo.
- Si cambia algo visible: hoja «antes / después» para que Sebastián apruebe las referencias nuevas. Hasta su OK, no está terminado.

## Normas de código (resumen de la especificación, sección 2)
- **Una fuente de verdad:** colores y aspecto solo en `src/temas/*.ts` (por tema × modo) y `src/estilo/tokens.ts`. Ningún color literal en otro sitio.
- **Ningún caso por tema fuera de `temas/`:** nada de `tema === 'lluvia'` ni `dark ? … : …`. Si hace falta, es un campo del tema.
- **Un solo vidrio (`.vidrio`) y un solo control (`.control`).** No se crean variantes ni reglas más específicas para «ganar»: se borra la regla vieja.
- **CSS:** especificidad ≤ 0,2,0, cero `!important`, un archivo CSS por componente, solo `backdrop-filter` sin prefijo (el `-webkit-` lo pone el compilador).
- **Colocación:** solo `layout/calcularLayout.ts`, con medidas reales (`useMedidas`). Ningún alto adivinado, ningún `vw/vh` para la hora, números con nombre en `layout/medidas.ts`.
- **Frasco:** una sola geometría, la máscara `jar-mask.webp`. Gravedad, agua, chorro y luz en el espacio del mundo, misma escala en x e y. Solo el vidrio gira.
- **Tests que prueban de verdad:** un test no puede usar la misma fórmula que el código que prueba. Se mide el píxel o el valor calculado en el navegador.
- **Nada visual lleva test** (colores, espacios, tamaños, posiciones): lo revisa Sebastián en la preview. Solo se mantienen el barrido de no solapes en todos los tamaños, la física del frasco y su contenido, y la regresión de bugs de comportamiento ya arreglados (el vídeo que no cambia de escena, el frasco que no gira en pausa). Si un test visual existente hace perder tiempo, se borra y se avisa.
- **Módulos pequeños:** unas 200 líneas por archivo, funciones de 60 como máximo, lógica pura separada de React y del dibujo. Sin apaños, sin `setTimeout` de reintento, sin código muerto.
- **Rendimiento:** un solo bucle de animación que se duerme en reposo; presupuestos de la sección 3.17.

## Si algo no está claro
Para y pregunta. No inventes una decisión de diseño. Las decisiones de Sebastián están en la especificación.

## No pierdas el tiempo
Norma permanente, también para las fases siguientes. Si te topas con algo que te hace perder tiempo (un test inestable, CI lento o roto, una herramienta que falla, varios intentos sin avanzar, una duda de alcance), no insistas a ciegas. Para, explícalo en dos líneas en el informe y termina el turno. Sebastián decide cómo seguir.
