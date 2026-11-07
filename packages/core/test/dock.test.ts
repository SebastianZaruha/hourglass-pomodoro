import { describe, expect, it } from 'vitest';
import { DOCK_MIN_HEIGHT, DOCK_MIN_WIDTH, dockIsRoomy } from '../src';

describe('barra web', () => {
  it('una ventana grande muestra la fila fija', () => {
    expect(dockIsRoomy(1280, 800)).toBe(true);
    expect(dockIsRoomy(DOCK_MIN_WIDTH, DOCK_MIN_HEIGHT)).toBe(true);
  });

  it('si falta ancho o alto, solo el menú hasta que haya hover', () => {
    expect(dockIsRoomy(800, 900)).toBe(false);
    expect(dockIsRoomy(1200, 600)).toBe(false);
    expect(dockIsRoomy(480, 720)).toBe(false);
  });
});
