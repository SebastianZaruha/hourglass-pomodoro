import tseslint from 'typescript-eslint';

/**
 * Normas N1 y N8, aparte del ESLint general (ese sigue en verde).
 * Los incumplimientos de hoy están en normas/fallos-conocidos.txt.
 */
export default tseslint.config(
  { ignores: ['src/temas/**', 'src/estilo/**', 'src/**/*.d.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'N1: el color literal vive en temas/ o en estilo/tokens.ts.',
        },
        {
          selector: 'Literal[value=/rgba?\\(|hsla?\\(/]',
          message: 'N1: el color literal vive en temas/ o en estilo/tokens.ts.',
        },
        {
          selector: 'BinaryExpression[right.value=/^(lluvia|clasico|miel|nieve)$/]',
          message: 'N8: nada de comparar con un id de tema fuera de temas/.',
        },
        {
          selector: "BinaryExpression[operator='!=='][right.value='arena']",
          message: 'N8: nada de comparar con un id de tema fuera de temas/.',
        },
        {
          selector: "ConditionalExpression[test.name='dark']",
          message: 'N8: el modo es un dato del tema, no un ternario dark.',
        },
      ],
    },
  },
);
