/**
 * Agua de Lluvia.
 *
 * El recorte del bulbo lo hace el path interior. Aquí solo queda el
 * semiplano bajo la línea ondulada, la foto con una lupa (sin escalón en
 * el borde), un desvío de la ola y un velo gris (sin azul).
 *
 * Los números de arriba se hornean en el shader. Sebastián los ajusta.
 */

/** Desplazamiento máximo de la lupa, en px, en el centro del agua. En el borde es 0. */
const LUPA = 4;
/** Cuánto desplaza la ola la muestra, en px, cuando la ola está en su tope. */
const DESVIO_OLA = 14;
/** Muestras del fondo. El radio es el de cada muestra alrededor del centro. */
const MUESTRAS = 5;
const RADIO_DESENFOQUE = 2.5;
/** Velo gris neutro: poco en la superficie, más al fondo. */
const VELO_MIN = 0.18;
const VELO_MAX = 0.42;
/** Gris de un solo canal. Claro arriba, oscuro al fondo. Nada de azul. */
const GRIS_CLARO = 0.91;
const GRIS_OSCURO = 0.25;

const muestras = [
  [0, 0],
  [RADIO_DESENFOQUE, 0],
  [-RADIO_DESENFOQUE, 0],
  [0, RADIO_DESENFOQUE],
  [0, -RADIO_DESENFOQUE],
]
  .slice(0, MUESTRAS)
  .map(([x, y]) => `s += uBackground.eval(p + float2(${x}, ${y}));`)
  .join('\n  ');

export const AGUA_SKSL = /* glsl */ `
uniform shader uBackground;
uniform float uSen;
uniform float uCs;
uniform float uSplit;
uniform float uHA;
uniform float uHB;
uniform float uSA0;
uniform float uSA1;
uniform float uSB0;
uniform float uSB1;
uniform float uRA;
uniform float uRB;
uniform float uDibA;
uniform float uDibB;
uniform float4 uOA0;
uniform float4 uOA1;
uniform float4 uOB0;
uniform float4 uOB1;
uniform float2 uParallax;

float toma8(float t, float4 a, float4 b) {
  float f = clamp(t, 0.0, 1.0) * 7.0;
  float i = floor(f);
  float fr = f - i;
  float y0 = a.x;
  float y1 = a.y;
  if (i >= 1.0) { y0 = a.y; y1 = a.z; }
  if (i >= 2.0) { y0 = a.z; y1 = a.w; }
  if (i >= 3.0) { y0 = a.w; y1 = b.x; }
  if (i >= 4.0) { y0 = b.x; y1 = b.y; }
  if (i >= 5.0) { y0 = b.y; y1 = b.z; }
  if (i >= 6.0) { y0 = b.z; y1 = b.w; }
  return mix(y0, y1, fr);
}

half4 fondo(float2 p) {
  half4 s = half4(0.0);
  ${muestras}
  return s / ${MUESTRAS}.0;
}

half4 main(float2 pos) {
  float arriba = pos.y < uSplit ? 1.0 : 0.0;
  float dib = mix(uDibB, uDibA, arriba);
  if (dib < 0.5) return half4(0.0);
  float h = mix(uHB, uHA, arriba);
  float s0 = mix(uSB0, uSA0, arriba);
  float s1 = mix(uSB1, uSA1, arriba);
  float rango = max(mix(uRB, uRA, arriba), 1.0);
  float proj = pos.x * uSen + pos.y * uCs;
  float s = pos.x * uCs - pos.y * uSen;
  float ancho = max(s1 - s0, 1.0);
  float t = (s - s0) / ancho;
  float4 a0 = arriba > 0.5 ? uOA0 : uOB0;
  float4 a1 = arriba > 0.5 ? uOA1 : uOB1;
  float onda = toma8(t, a0, a1);
  if (proj < h + onda) return half4(0.0);

  float u = clamp(t, 0.0, 1.0);
  float campana = 4.0 * u * (1.0 - u);
  float profundidad = clamp((proj - (h + onda)) / rango, 0.0, 1.0);
  float2 normal = float2(uSen, uCs);
  float2 tangente = float2(uCs, -uSen);
  float ola = onda / max(rango * 0.04, 1.0);
  float2 muestra = pos - uParallax - normal * (${LUPA} * campana * profundidad) + tangente * ola * ${DESVIO_OLA};
  half4 bg = fondo(muestra);
  half3 velo = mix(half3(${GRIS_CLARO}, ${GRIS_CLARO}, ${GRIS_CLARO}), half3(${GRIS_OSCURO}, ${GRIS_OSCURO}, ${GRIS_OSCURO}), profundidad);
  float alfa = mix(${VELO_MIN}, ${VELO_MAX}, profundidad);
  if (bg.a < 0.01) return half4(half3(velo * alfa), alfa);
  float ba = max(float(bg.a), 0.001);
  half3 rgb = bg.rgb / ba;
  return half4(half3(mix(rgb, velo, alfa)), 1.0);
}
`;
