import { describe, expect, it } from 'vitest';
import {
  PAUSE_RULE_INITIAL,
  pausePresentation,
  pauseRule,
  type PauseInput,
  type PauseRuleState,
  type TimerStatus,
} from '../src';

/** Simula la pantalla: aplica cada entrada y el estado del reloj que resulta. */
function run(inputs: readonly (PauseInput | ((status: TimerStatus) => PauseInput))[], start: TimerStatus) {
  let status = start;
  let state: PauseRuleState = PAUSE_RULE_INITIAL;
  const actions: string[] = [];
  for (const raw of inputs) {
    const input = typeof raw === 'function' ? raw(status) : raw;
    const d = pauseRule(state, input);
    state = d.state;
    actions.push(d.action);
    if (d.action === 'pause') status = 'paused';
    if (d.action === 'resume') status = 'running';
    if (d.action === 'toggle') status = status === 'running' ? 'paused' : 'running';
  }
  return { status, state, actions };
}

const tap =
  (sideways: boolean) =>
  (status: TimerStatus): PauseInput => ({ type: 'tap', status, sideways });
const tiltPause = (status: TimerStatus): PauseInput => ({ type: 'tilt-pause', status });
const tiltResume = (status: TimerStatus): PauseInput => ({ type: 'tilt-resume', status });

describe('pauseRule (1.8.6)', () => {
  it('tumbar en marcha pausa y ponerlo de pie reanuda (como siempre)', () => {
    const r = run([tiltPause, tiltResume], 'running');
    expect(r.actions).toEqual(['pause', 'resume']);
    expect(r.status).toBe('running');
  });

  it('pausa con el dedo, de lado y de pie: sigue en pausa hasta tocar', () => {
    const r = run([tap(false), tiltPause, tiltResume], 'running');
    expect(r.actions).toEqual(['toggle', 'none', 'none']);
    expect(r.status).toBe('paused');
    // Y un toque de pie la reanuda.
    expect(pauseRule(r.state, { type: 'tap', status: 'paused', sideways: false }).action).toBe('toggle');
  });

  it('de lado, tocar no reanuda (fallo B de la 1.8.5): solo una pista', () => {
    const r = run([tap(false), tiltPause, tap(true), tap(true)], 'running');
    expect(r.actions).toEqual(['toggle', 'none', 'hint', 'hint']);
    expect(r.status).toBe('paused');
  });

  it('pausa de lado + toque de lado: al ponerlo de pie sigue reanudándose sola', () => {
    const r = run([tiltPause, tap(true), tiltResume], 'running');
    expect(r.actions).toEqual(['pause', 'hint', 'resume']);
    expect(r.status).toBe('running');
  });

  it('de lado tampoco empieza un reloj parado o terminado', () => {
    for (const status of ['idle', 'finished'] as const) {
      expect(pauseRule(PAUSE_RULE_INITIAL, { type: 'tap', status, sideways: true }).action).toBe('hint');
    }
  });

  it('si de lado corría (se tumbó estando plano), el toque lo pausa y cuenta como tuyo', () => {
    const d = pauseRule(PAUSE_RULE_INITIAL, { type: 'tap', status: 'running', sideways: true });
    expect(d).toEqual({ state: { tiltOnly: false }, action: 'pause' });
  });

  it('una pausa desde la notificación (en pausa sin tumbar) no se quita al ponerlo de pie', () => {
    const r = run([tiltPause, tiltResume], 'paused');
    expect(r.actions).toEqual(['none', 'none']);
    expect(r.status).toBe('paused');
  });

  it('voltear olvida la pausa de lado', () => {
    const tilted = pauseRule(PAUSE_RULE_INITIAL, { type: 'tilt-pause', status: 'running' }).state;
    expect(tilted.tiltOnly).toBe(true);
    expect(pauseRule(tilted, { type: 'flip' }).state.tiltOnly).toBe(false);
  });

  it('de pie sin pausa no hace nada', () => {
    expect(pauseRule(PAUSE_RULE_INITIAL, { type: 'tilt-resume', status: 'running' }).action).toBe('none');
    expect(pauseRule(PAUSE_RULE_INITIAL, { type: 'tilt-pause', status: 'idle' }).action).toBe('none');
  });
});

describe('pausePresentation', () => {
  it('de lado, siempre como la pausa de lado (fallo A: el rótulo gira)', () => {
    expect(pausePresentation('paused', true)).toEqual({ blur: 'full', landscape: true });
  });
  it('de pie, la pausa ligera y el rótulo derecho', () => {
    expect(pausePresentation('paused', false)).toEqual({ blur: 'soft', landscape: false });
  });
  it('sin pausa, nada', () => {
    for (const s of ['idle', 'running', 'finished'] as const) {
      expect(pausePresentation(s, true)).toEqual({ blur: 'none', landscape: false });
    }
  });
});
