import { describe, expect, it } from 'vitest';
import {
  freshDetail,
  flowSpan,
  shapeBudget,
  streamDetail,
  takeSimSteps,
  updateDetail,
  type StepBudget,
} from '../src';

describe('pasos de simulación según el refresco', () => {
  const slot = (): StepBudget => ({ steps: 0, debt: 0 });

  it('a 60 Hz son 2 pasos, como antes; a 120 Hz es 1', () => {
    const at60 = slot();
    takeSimSteps(0, 1 / 60, false, at60);
    expect(at60.steps).toBe(2);
    expect(at60.debt).toBeCloseTo(0);

    const at120 = slot();
    takeSimSteps(0, 1 / 120, false, at120);
    expect(at120.steps).toBe(1);
    expect(at120.debt).toBeCloseTo(0);
  });

  it('un fotograma largo no pide más de 6 pasos, y el LOD pide 1', () => {
    const slow = slot();
    takeSimSteps(0, 1 / 10, false, slow);
    expect(slow.steps).toBe(6);
    const lod = slot();
    takeSimSteps(0.9, 1 / 30, true, lod);
    expect(lod).toEqual({ steps: 1, debt: 0 });
  });

  it('el caudal de 60 Hz no cambia; a 120 Hz el tope es la mitad', () => {
    expect(flowSpan(1 / 60)).toBeCloseTo(1);
    expect(flowSpan(1 / 120)).toBeCloseTo(0.5);
    expect(flowSpan(1 / 20)).toBeCloseTo(3);
  });
});

describe('calidad adaptativa', () => {
  it('un móvil holgado se queda en alta', () => {
    const clock = freshDetail();
    for (let i = 0; i < 10; i++) updateDetail(clock, { jsMs: 4, gapMs: 8.3 });
    expect(clock.level).toBe('alta');
    expect(streamDetail('alta')).toBe(1);
    expect(shapeBudget('alta').waves).toBe(true);
  });

  it('baja si el JavaScript no cabe en 120 Hz, y no castiga un 60 Hz holgado', () => {
    const tight = freshDetail();
    for (let i = 0; i < 4; i++) updateDetail(tight, { jsMs: 11, gapMs: 16 });
    expect(tight.level).toBe('media');
    expect(shapeBudget('media').waves).toBe(false);

    const panel60 = freshDetail();
    for (let i = 0; i < 8; i++) updateDetail(panel60, { jsMs: 4, gapMs: 16.7 });
    expect(panel60.level).toBe('alta');
  });
});
