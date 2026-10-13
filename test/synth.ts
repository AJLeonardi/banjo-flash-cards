// Karplus-Strong plucked-string synth for testing the detector offline.
import { FIFTH_STRING, midiToFreq } from '../src/music/notes';

export const SR = 48000;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
}

export function pluck(out: Float32Array, start: number, midi: number, gain: number, seed: number, decay = 0.996) {
  const period = SR / midiToFreq(midi);
  const n = Math.floor(period);
  const frac = period - n;
  const buf = new Float32Array(n + 2);
  const r = rng(seed);
  for (let i = 0; i < buf.length; i++) buf[i] = r() * 2;
  let idx = 0;
  for (let t = start; t < out.length; t++) {
    const a = buf[idx % buf.length];
    const b = buf[(idx + 1) % buf.length];
    const y = a * (1 - frac) + b * frac;
    out[t] += y * gain;
    buf[idx % buf.length] = decay * 0.5 * (a + b);
    idx++;
  }
}

/** Strum notes low→high, 12 ms apart, starting at `at` seconds. Includes the 5th string by default. */
export function strum(midis: number[], opts: { at?: number; dur?: number; drone?: boolean; seed?: number; noise?: number; into?: Float32Array } = {}) {
  const { at = 0.1, dur = 0.6, drone = true, seed = 1, noise = 0.002 } = opts;
  const out = opts.into ?? new Float32Array(Math.round(SR * dur));
  const notes = drone ? [FIFTH_STRING, ...midis] : midis;
  notes.forEach((m, i) => pluck(out, Math.round(SR * (at + i * 0.012)), m, 0.25, seed * 31 + i));
  const r = rng(seed + 999);
  for (let i = 0; i < out.length; i++) out[i] += r() * noise;
  return out;
}

/** The analysis window the live engine uses: audio up to `at + delay`. */
export function windowAfter(buf: Float32Array, at: number, delay = 0.22) {
  return buf.subarray(0, Math.min(buf.length, Math.round(SR * (at + delay))));
}
