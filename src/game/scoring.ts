// Beat-window scoring: each chord change is a target at a downbeat. A correct
// strum within ±window of it scores +1; a target that passes without one scores −1.

export type TargetResult = 'pending' | 'hit' | 'miss';

export interface Target {
  index: number;
  time: number;
  voicingId: string;
  result: TargetResult;
  /** Strum time minus target time (seconds), for hits. */
  offset?: number;
}

export class GameScorer {
  readonly targets: Target[];

  constructor(times: number[], voicingIds: string[], private window: number) {
    this.targets = times.map((time, index) => ({ index, time, voicingId: voicingIds[index], result: 'pending' }));
  }

  /** Report a judged strum. Returns the target it hit, if any. */
  strum(time: number, voicingId: string, correct: boolean): Target | null {
    if (!correct) return null;
    const t = this.targets.find(
      (x) => x.result === 'pending' && x.voicingId === voicingId && Math.abs(time - x.time) <= this.window,
    );
    if (!t) return null;
    t.result = 'hit';
    t.offset = time - t.time;
    return t;
  }

  /** Mark targets whose window (plus analysis delay) has passed as misses. */
  expire(now: number, grace: number): Target[] {
    const out: Target[] = [];
    for (const t of this.targets) {
      if (t.result === 'pending' && now > t.time + this.window + grace) {
        t.result = 'miss';
        out.push(t);
      }
    }
    return out;
  }

  get hits() {
    return this.targets.filter((t) => t.result === 'hit').length;
  }
  get misses() {
    return this.targets.filter((t) => t.result === 'miss').length;
  }
  get score() {
    return this.hits - this.misses;
  }
  get done() {
    return this.targets.every((t) => t.result !== 'pending');
  }
}

/** Downbeat times for a game: count-in of one bar, then a chord every `beatsPerChord` beats. */
export function targetTimes(start: number, bpm: number, beatsPerChord: number, seconds: number): number[] {
  const beat = 60 / bpm;
  const first = start + 4 * beat;
  const n = Math.floor(seconds / (beat * beatsPerChord));
  return Array.from({ length: n }, (_, i) => first + i * beatsPerChord * beat);
}
