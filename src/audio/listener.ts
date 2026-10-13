// Ties onset detection to chord analysis: on each strum, wait for the notes to
// settle (EVAL_DELAY), then analyze the audio just after the strum.

import { analyze, Analysis } from './analyzer';
import { OnsetDetector, OnsetOptions } from './onset';

export const EVAL_DELAY = 0.22;

export interface StrumEvent {
  onsetTime: number;
  analysis: Analysis;
}

export class ListenerCore {
  readonly onsets: OnsetDetector;
  private pending: number | null = null;

  constructor(private sampleRate: number, opts: OnsetOptions) {
    this.onsets = new OnsetDetector(sampleRate, opts);
  }

  /** `samples` is the most recent audio (≥ 0.25 s), ending at time `now`. */
  feed(samples: Float32Array, now: number): StrumEvent | null {
    const onset = this.onsets.process(samples, now);
    if (onset !== null && this.pending === null) this.pending = onset;
    if (this.pending !== null && now >= this.pending + EVAL_DELAY) {
      const onsetTime = this.pending;
      this.pending = null;
      // Trim so the window ends ~EVAL_DELAY after the strum (the analyzer uses the last 0.17 s).
      const over = Math.max(0, Math.round((now - onsetTime - EVAL_DELAY) * this.sampleRate));
      const end = Math.max(0, samples.length - over);
      return { onsetTime, analysis: analyze(samples.subarray(0, end), this.sampleRate) };
    }
    return null;
  }
}
