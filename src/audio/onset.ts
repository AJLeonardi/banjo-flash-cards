// Strum detector: spectral flux over the banjo's band (80 Hz–2 kHz) with an
// adaptive threshold, or a sudden jump in loudness (catches a re-strum over a
// chord that's still ringing). The metronome click sits above 3 kHz so it
// doesn't trigger either.

import { magnitudeSpectrum } from './fft';

const FRAME = 1024;
const LOW_HZ = 80;
const HIGH_HZ = 2000;
const REFRACTORY = 0.15;

export interface OnsetOptions {
  /** 0 (deaf) .. 1 (twitchy). */
  sensitivity: number;
}

export class OnsetDetector {
  private prev: Float32Array | null = null;
  private history: number[] = [];
  private lastOnset = -Infinity;
  private lo: number;
  private hi: number;
  lastFlux = 0;
  lastBandRms = 0;

  constructor(private sampleRate: number, public opts: OnsetOptions) {
    this.lo = Math.floor((LOW_HZ * FRAME) / sampleRate);
    this.hi = Math.ceil((HIGH_HZ * FRAME) / sampleRate);
  }

  get minRms() {
    // sensitivity 0 → 0.03, 1 → 0.001 (log scale)
    return 0.03 * Math.pow(0.001 / 0.03, this.opts.sensitivity);
  }

  /** Feed the latest audio (ending at time `now`). Returns the onset time if a strum just started. */
  process(samples: Float32Array, now: number): number | null {
    const mag = magnitudeSpectrum(samples, FRAME, FRAME);
    let flux = 0;
    for (let b = this.lo; b <= this.hi; b++) {
      const cur = Math.log1p(100 * mag[b]);
      const was = this.prev ? Math.log1p(100 * this.prev[b]) : cur;
      if (cur > was) flux += cur - was;
    }
    this.prev = mag;
    this.lastFlux = flux;

    const sorted = [...this.history].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    this.history.push(flux);
    if (this.history.length > 40) this.history.shift();

    this.lastBandRms = this.bandRms(mag);
    const loud = this.lastBandRms > this.minRms;
    const minFlux = 6 + 30 * (1 - this.opts.sensitivity);
    const fluxHit = flux > Math.max(minFlux, median * 2.5);
    const jumpHit = this.energyJump(samples, mag) > 1.8 - 0.4 * this.opts.sensitivity;
    if (loud && (fluxHit || jumpHit) && now - this.lastOnset > REFRACTORY) {
      const t = this.refine(samples, now);
      this.lastOnset = t;
      return t;
    }
    return null;
  }

  /** RMS of the signal within the band (Parseval, corrected for the Hann window). */
  bandRms(mag: Float32Array): number {
    let e = 0;
    for (let k = this.lo; k <= this.hi; k++) e += mag[k] * mag[k];
    return Math.sqrt((2 * e) / (FRAME * FRAME * 0.375));
  }

  /** In-band loudness of the latest frame vs. the frame before it (amplitude ratio). */
  private energyJump(samples: Float32Array, mag: Float32Array): number {
    if (samples.length < 2 * FRAME) return 0;
    const before = magnitudeSpectrum(samples.subarray(0, samples.length - FRAME), FRAME, FRAME);
    let a = 0, b = 0;
    for (let k = this.lo; k <= this.hi; k++) {
      a += mag[k] * mag[k];
      b += before[k] * before[k];
    }
    return b > 0 ? Math.sqrt(a / b) : 0;
  }

  /** Locate the energy rise inside the last ~2048 samples for a sharper timestamp. */
  private refine(samples: Float32Array, now: number): number {
    const hop = 128;
    const region = Math.min(samples.length, 2048);
    const start = samples.length - region;
    const e: number[] = [];
    for (let i = start; i + hop <= samples.length; i += hop) {
      let s = 0;
      for (let j = i; j < i + hop; j++) s += samples[j] * samples[j];
      e.push(s);
    }
    const base = Math.min(...e.slice(0, 3));
    const max = Math.max(...e);
    const k = Math.max(0, e.findIndex((x) => x > base + 0.3 * (max - base)));
    return now - (samples.length - (start + k * hop)) / this.sampleRate;
  }
}
