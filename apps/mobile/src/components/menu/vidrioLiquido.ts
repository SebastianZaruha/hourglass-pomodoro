/**
 * Vidrio líquido de las hojas. Los números salen de la web
 * (`vidrio-liquido.css`): desenfoque, tinte, canto gris. Sin borde blanco
 * y sin sombra. El texto y los iconos siguen la paleta de la escena.
 */
export const VIDRIO = {
  /** σ del desenfoque, en px. En la web es clamp(6px, 0.6vw, 12px). */
  blur: 12,
  /** Lavado sobre el desenfoque. En la web el velo de la hoja es transparente. */
  tinteClaro: 'rgba(247, 243, 237, 0.22)',
  tinteOscuro: 'rgba(16, 13, 10, 0.32)',
  /** Canto de 1 px. Casi nada: el filo de arriba no debe leerse como una línea blanca. */
  canto: 'rgba(170, 170, 170, 0.06)',
  cantoArriba: 'rgba(170, 170, 170, 0)',
  /** Humo de los controles (--vl-humo). */
  humo: 'rgba(0, 0, 0, 0.08)',
  /**
   * Diálogo encima del menú (consentimiento). El desenfoque del lienzo no
   * tapa el texto de la hoja: este velo sí, y el texto de la hoja se apaga.
   */
  blurDialogo: 32,
  tinteDialogoClaro: 'rgba(247, 243, 237, 0.82)',
  tinteDialogoOscuro: 'rgba(16, 13, 10, 0.86)',
  /**
   * Pastilla detrás del reloj, como la web en vertical. El desenfoque y el
   * canto son los de la hoja. Sin sombra y sin borde blanco.
   */
  reloj: {
    ancho: 176,
    paddingArriba: 14,
    paddingAbajo: 15,
    radio: 28,
  },
} as const;
