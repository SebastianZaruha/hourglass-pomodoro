/**
 * Medidas de la foto del frasco (891×2048). El hueco interior sale de la
 * máscara; el pie es el apoyo del vidrio, un poco por debajo de ese hueco.
 * Cambiarlas mueve el frasco en la escena.
 */
export const JAR_ASPECT = 891 / 2048;
export const JAR_FOOT_X = 0.5;
export const JAR_FOOT_Y = 0.9786995515695067;
/** Fila del cuello en la máscara, 952 / 2048. */
export const JAR_NECK_Y = 952 / 2048;

export const JAR_TOP_BOX = [0.05948372615039282, 0.0302734375, 0.9427609427609428, 0.46533203125] as const;
export const JAR_BOT_BOX = [0.05948372615039282, 0.50439453125, 0.9427609427609428, 0.955078125] as const;
