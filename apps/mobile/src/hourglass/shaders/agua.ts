/**
 * Agua de Lluvia.
 *
 * El recorte del bulbo lo hace el path interior. Aquí solo queda el
 * semiplano bajo la línea ondulada, la foto con una refracción pequeña
 * y un velo gris (sin azul): claro arriba, más oscuro al fondo.
 */
export const AGUA_SKSL = /* glsl */ `
uniform shader uBackground;
uniform float uAlfa;
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
uniform float uRefraccion;

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

half4 main(float2 pos) {
  float arriba = pos.y < uSplit ? 1.0 : 0.0;
  float dib = mix(uDibB, uDibA, arriba);
  if (dib < 0.5) return half4(0.0);
  float h = mix(uHB, uHA, arriba);
  float s0 = mix(uSB0, uSA0, arriba);
  float s1 = mix(uSB1, uSA1, arriba);
  float rango = max(mix(uRB, uRA, arriba), 1.0);
  float sen = sin(uAlfa);
  float cs = cos(uAlfa);
  float proj = pos.x * sen + pos.y * cs;
  float s = pos.x * cs - pos.y * sen;
  float ancho = max(s1 - s0, 1.0);
  float t = (s - s0) / ancho;
  float4 a0 = arriba > 0.5 ? uOA0 : uOB0;
  float4 a1 = arriba > 0.5 ? uOA1 : uOB1;
  float onda = toma8(t, a0, a1);
  if (proj < h + onda) return half4(0.0);

  float t2 = clamp(t + 0.08, 0.0, 1.0);
  float pendiente = (toma8(t2, a0, a1) - onda) / max((t2 - t) * ancho, 1.0);
  float2 normal = float2(sen, cs);
  float2 tangente = float2(cs, -sen);
  float2 muestra = pos - uParallax - normal * uRefraccion + tangente * pendiente * 5.0;
  half4 bg = uBackground.eval(muestra);
  float profundidad = clamp((proj - (h + onda)) / rango, 0.0, 1.0);
  half3 velo = mix(half3(232.0 / 255.0, 232.0 / 255.0, 232.0 / 255.0), half3(64.0 / 255.0, 64.0 / 255.0, 64.0 / 255.0), profundidad);
  float alfa = mix(0.12, 0.33, profundidad);
  if (bg.a < 0.01) return half4(half3(velo * alfa), alfa);
  float ba = max(float(bg.a), 0.001);
  half3 rgb = bg.rgb / ba;
  return half4(half3(mix(rgb, velo, alfa)), 1.0);
}
`;
