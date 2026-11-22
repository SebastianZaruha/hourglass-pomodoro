/**
 * La nube del vídeo. El negro del archivo pasa a alfa (suelo 28/255)
 * y la base se disuelve: opaca hasta el 42 % del alto, transparente al 100 %.
 * En oscuro, brillo 0,72 y saturación 0,85.
 */
export const NUBE_SKSL = /* glsl */ `
uniform shader uFrame;
uniform float uY;
uniform float uH;
uniform float uOscuro;

half4 main(float2 pos) {
  half4 c = uFrame.eval(pos);
  float pico = max(c.r, max(c.g, c.b));
  float suelo = 28.0 / 255.0;
  float a = pico <= suelo ? 0.0 : clamp((pico - suelo) / (1.0 - suelo), 0.0, 1.0);
  float t = clamp((pos.y - uY) / max(uH, 1.0), 0.0, 1.0);
  float mascara = t <= 0.42 ? 1.0 : (1.0 - t) / 0.58;
  a *= mascara * c.a;
  float luma = dot(c.rgb, half3(0.2126, 0.7152, 0.0722));
  half3 sat = mix(half3(luma), c.rgb, 0.85) * 0.72;
  half3 col = mix(c.rgb, sat, uOscuro);
  return half4(col * a, a);
}
`;
