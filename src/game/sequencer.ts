// Picks the next chord to play, keeping the hand move within the allowed fret jump.

import { CHORD_BY_ID, Voicing } from '../music/library';

/** `positions`: which position numbers to include; 5 means "5 and up". Empty = all. */
export function buildPool(chordIds: string[], positions: number[] = []): Voicing[] {
  const want = new Set(positions);
  return chordIds
    .flatMap((id) => CHORD_BY_ID[id]?.voicings ?? [])
    .filter((v) => want.size === 0 || want.has(Math.min(v.position, 5)));
}

export class Sequencer {
  private prev: Voicing | null = null;

  constructor(
    private pool: Voicing[],
    private maxJump: number,
    private biasFar = false,
    private rand: () => number = Math.random,
  ) {}

  next(): Voicing {
    const prev = this.prev;
    let choice: Voicing;
    if (!prev || this.pool.length === 1) {
      choice = this.pool[Math.floor(this.rand() * this.pool.length)];
    } else {
      const others = this.pool.filter((v) => v.id !== prev.id);
      // Loosen the jump limit gradually if nothing fits (e.g. only one chord selected).
      let cands: Voicing[] = [];
      for (let jump = this.maxJump; cands.length === 0; jump += 2) {
        cands = others.filter((v) => Math.abs(v.anchor - prev.anchor) <= jump);
      }
      const weights = cands.map((v) => {
        let w = v.chordId !== prev.chordId ? 2 : 1; // prefer an actual chord change
        if (this.biasFar && Math.abs(v.anchor - prev.anchor) >= 5) w *= 3;
        return w;
      });
      let r = this.rand() * weights.reduce((a, b) => a + b, 0);
      choice = cands[cands.length - 1];
      for (let i = 0; i < cands.length; i++) {
        if ((r -= weights[i]) < 0) {
          choice = cands[i];
          break;
        }
      }
    }
    this.prev = choice;
    return choice;
  }
}
