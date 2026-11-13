/** Normas N1, N4 y N5. Hoy el CSS de 25fca17 las incumple: el fallo queda registrado. */
export default {
  ignoreFiles: ['dist/**', 'e2e/**', 'node_modules/**', 'test/**'],
  rules: {
    'color-no-hex': true,
    'declaration-no-important': true,
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
    'property-disallowed-list': ['-webkit-backdrop-filter'],
    'selector-max-specificity': '0,2,0',
  },
};
