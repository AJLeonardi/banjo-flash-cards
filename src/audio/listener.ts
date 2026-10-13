// Turns onsets into strum *gestures* and analyzes them as they unfold.
//
// A strum isn't instantaneous: a relaxed strum or a pinch-and-roll spreads the
// strings over a few hundred ms. So the first note opens a gesture; while it's
// open we re-analyze every EVAL_EVERY (the analysis window holds whatever is still
// ringing, so the chord accumulates). Consumers can accept a check as soon as it's
// correct (and call endGesture), but should only reject on the `final` check, which
// comes once the player has stopped adding notes for SETTLE, or after MAX_GESTURE.

import { analyze, Analysis } from './analyzer';
import { OnsetDetector, OnsetOptions } from './onset';

/** First check, after the first note: the analysis window (~0.17 s) is then all post-strum audio. */
export const FIRST_EVAL = 0.2;
export const EVAL_EVERY = 0.06;
/** Quiet time after the last new note before the gesture is judged. */
export const SETTLE = 0.35;
export const MAX_GESTURE = 1.6;
/** Worst-case time from a strum's first note to its final verdict. */
export const MAX_VERDICT_DELAY = MAX_GESTURE + EVAL_EVERY;

export interface StrumEvent {
  /** When the gesture's first note started (used for beat timing). */
  onsetTime: number;
  analysis: Analysis;
  /** Last check of this gesture: reject only on this one. */
  final: boolean;
  /** The analyzed audio (debug: lets a player save real samples for tuning). */
  samples: Float32Array;
  sampleRate: number;
}

interface Gesture {
  start: number;
  lastOnset: number;
  nextEval: number;
}

export class ListenerCore {
  readonly onsets: OnsetDetector;
  private gesture: Gesture | null = null;
  private quietUntil = -Infinity;

  constructor(private sampleRate: number, opts: OnsetOptions) {
    this.onsets = new OnsetDetector(sampleRate, opts);
  }

  /**
   * Stop analyzing the current gesture (it's been accepted), and ignore new notes until
   * `now + cooldown` — the tail of a slow strum shouldn't count against the next chord.
   */
  endGesture(now: number, cooldown = 0) {
    this.gesture = null;
    this.quietUntil = now + cooldown;
  }

  /** `samples` is the most recent audio (≥ 0.25 s), ending at time `now`. */
  feed(samples: Float32Array, now: number): StrumEvent | null {
    const onset = this.onsets.process(samples, now);
    if (onset !== null && onset >= this.quietUntil) {
      if (this.gesture) this.gesture.lastOnset = onset;
      else this.gesture = { start: onset, lastOnset: onset, nextEval: onset + FIRST_EVAL };
    }
    const g = this.gesture;
    if (!g || now < g.nextEval) return null;

    const final = now >= g.lastOnset + SETTLE || now >= g.start + MAX_GESTURE;
    g.nextEval = now + EVAL_EVERY;
    if (final) this.gesture = null;
    return { onsetTime: g.start, analysis: analyze(samples, this.sampleRate), final, samples: samples.slice(), sampleRate: this.sampleRate };
  }
}
