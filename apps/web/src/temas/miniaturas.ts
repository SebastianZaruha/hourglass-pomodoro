/** Miniatura borrosa, en línea, de menos de 1 KB por tema. Se ve antes que la foto. */
export const MINIATURAS = {
  'lluvia-claro':
    'data:image/webp;base64,UklGRloAAABXRUJQVlA4IE4AAADwAgCdASoYAA4AP0WKu1SwKSYjMAgCACiJZQC+SDbQAAD9r7E54O8rC++M6+4zaZ09/9OX1GUejvI4VXUy7021Wp+Gq2nnAqIgucwAAAA=',
  'lluvia-oscuro':
    'data:image/webp;base64,UklGRkIAAABXRUJQVlA4IDYAAADwAgCdASoYAA4AP0WQwFYwKicjsAgCACiJZwDA3DbQAAD+6Zd8kwl0EBVj2XdSmBUgsHOroAA=',
  'arena-claro':
    'data:image/webp;base64,UklGRlAAAABXRUJQVlA4IEQAAADQAgCdASoYAA4AP0WKvFSwKaYjMAgCACiJQBOgCGRAAP7hn1Bo9nP/pWGi+W/Y9uf9R/k41EAy1MFm4l+DJP6xEbqQAA==',
  'arena-oscuro':
    'data:image/webp;base64,UklGRkoAAABXRUJQVlA4ID4AAADwAgCdASoYAA4AP0WKu1SwKSYjMAgCACiJYwCo9DbQAAD+6/Y9PMTtVvV9+da5JK9f/9t4Id2p4UaqC+AAAA==',
  'clasico-claro':
    'data:image/webp;base64,UklGRkYAAABXRUJQVlA4IDoAAADwAgCdASoYAA4AP0WMwFSwKacjMAgCACiJZwC3uEO0gAD+7GMpbYsV9OeT134xjzcjvwibkc5gAAAA',
  'clasico-oscuro':
    'data:image/webp;base64,UklGRkoAAABXRUJQVlA4ID4AAADwAgCdASoYAA4AP0WMvVSwKaajMAgCACiJZQCo9Dd3gAD+5kZeV2ctIZ9UH9BCdtRAEe93fCSt3c4ZWAAAAA==',
} as const;

export function miniaturaDe(url: string): string | undefined {
  if (url.includes('lluvia-oscuro')) return MINIATURAS['lluvia-oscuro'];
  if (url.includes('lluvia')) return MINIATURAS['lluvia-claro'];
  if (url.includes('arena-oscuro')) return MINIATURAS['arena-oscuro'];
  if (url.includes('arena')) return MINIATURAS['arena-claro'];
  if (url.includes('clasico-oscuro')) return MINIATURAS['clasico-oscuro'];
  if (url.includes('clasico')) return MINIATURAS['clasico-claro'];
  return undefined;
}
