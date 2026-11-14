import type { SessionCue } from '@reloj/core';

let audio: AudioContext | null = null;

function context(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

/** Desbloquea el audio en el primer gesto (los navegadores lo exigen). */
export function primeAudio(): void {
  context();
}

/**
 * Campanita corta, sintetizada (sin archivos).
 * El ajuste Sonido nace apagado: esto solo suena si la persona lo enciende.
 */
export function playCue(cue: SessionCue): void {
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = cue === 'finished' ? [523.25, 659.25, 783.99] : [587.33, 739.99];
  const peak = cue === 'finished' ? 0.07 : 0.045;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.6);
  });
}
