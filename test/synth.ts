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
  // y[t] = decay * avg(y[t-L], y[t-L-1]) has a delay of L + 0.5 samples; the rest of
  // the period comes from linear interpolation, so the pitch is accurate to a few cents.
  const period = SR / midiToFreq(midi);
  const L = Math.floor(period - 0.5);
  const frac = period - 0.5 - L;
  const n = out.length - start;
  if (n <= 0) return;
  const y = new Float32Array(n);
  const r = rng(seed);
  const burst = Math.min(n, L + 2);
  for (let t = 0; t < burst; t++) y[t] = r() * 2;
  let mean = 0;
  for (let t = 0; t < burst; t++) mean += y[t] / burst;
  for (let t = 0; t < burst; t++) y[t] -= mean; // no DC, or it never decays
  for (let t = L + 2; t < n; t++) {
    const a = y[t - L], b = y[t - L - 1], c = y[t - L - 2];
    y[t] = decay * 0.5 * ((1 - frac) * (a + b) + frac * (b + c));
  }
  for (let t = 0; t < n; t++) out[start + t] += y[t] * gain;
}

/** Strum notes low→high, `gap` apart (12 ms = a quick strum), starting at `at` seconds. Includes the 5th string by default. */
export function strum(
  midis: number[],
  opts: { at?: number; dur?: number; drone?: boolean; seed?: number; noise?: number; into?: Float32Array; gap?: number } = {},
) {
  const { at = 0.1, dur = 0.6, drone = true, seed = 1, noise = 0.002, gap = 0.012 } = opts;
  const out = opts.into ?? new Float32Array(Math.round(SR * dur));
  const notes = drone ? [FIFTH_STRING, ...midis] : midis;
  notes.forEach((m, i) => pluck(out, Math.round(SR * (at + i * gap)), m, 0.25, seed * 31 + i));
  const r = rng(seed + 999);
  for (let i = 0; i < out.length; i++) out[i] += r() * noise;
  return out;
}

/** The analysis window the live engine uses: audio up to `at + delay`. */
export function windowAfter(buf: Float32Array, at: number, delay = 0.22) {
  return buf.subarray(0, Math.min(buf.length, Math.round(SR * (at + delay))));
}
