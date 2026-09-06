// Web Audio API sound synthesizer with shared AudioContext

import { loadUserPreferences } from '../services/preferences.js';

let audioCtx: AudioContext | null = null;
let cachedVolume: number | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioConstructor) return null;

  if (!audioCtx) {
    audioCtx = new AudioConstructor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Autoplay policy: the context resumes after the first user gesture.
    });
  }
  return audioCtx;
}

function volume(): number {
  if (cachedVolume === null) {
    cachedVolume = loadUserPreferences().sound.volume;
  }
  return cachedVolume;
}

/** Re-read the stored volume after a settings change. */
export function invalidateSoundVolumeCache(): void {
  cachedVolume = null;
}

function gainAt(value: number): number {
  return Math.max(0.0001, value * volume());
}

export function playMoveSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(gainAt(0.2), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // Audio playback error gracefully ignored
  }
}

export function playCaptureSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(gainAt(0.3), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Gracefully ignore
  }
}

export function playCheckSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Two-tone warning beep
    const now = ctx.currentTime;
    [520, 680].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(gainAt(0.25), startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.08);
    });
  } catch {
    // Gracefully ignore
  }
}

export function playGameOverSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [330, 440, 550, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.07;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(gainAt(0.2), startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch {
    // Gracefully ignore
  }
}
