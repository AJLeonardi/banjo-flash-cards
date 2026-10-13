import { describe, expect, it } from 'vitest';
import { buildPool, Sequencer } from '../src/game/sequencer';
import { GameScorer, targetTimes } from '../src/game/scoring';

function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('sequencer', () => {
  it('keeps moves within the max jump when the pool allows it', () => {
    const pool = buildPool(['G', 'C', 'D']);
    for (const maxJump of [3, 7]) {
      const seq = new Sequencer(pool, maxJump, false, seeded(maxJump));
      let prev = seq.next();
      for (let i = 0; i < 300; i++) {
        const v = seq.next();
        expect(Math.abs(v.anchor - prev.anchor)).toBeLessThanOrEqual(maxJump);
        expect(v.id).not.toBe(prev.id);
        prev = v;
      }
    }
  });

  it('hard mode moves around the neck more', () => {
    const pool = buildPool(['G', 'C', 'D']);
    const avg = (s: Sequencer) => {
      let prev = s.next(), sum = 0;
      for (let i = 0; i < 500; i++) {
        const v = s.next();
        sum += Math.abs(v.anchor - prev.anchor);
        prev = v;
      }
      return sum / 500;
    };
    expect(avg(new Sequencer(pool, 17, true, seeded(1)))).toBeGreaterThan(avg(new Sequencer(pool, 3, false, seeded(1))) + 2);
  });

  it('copes with a single chord and filtered positions', () => {
    const pool = buildPool(['D'], [1, 2]);
    expect(pool.map((v) => v.position)).toEqual([1, 2]);
    const seq = new Sequencer(pool, 1);
    expect(() => Array.from({ length: 20 }, () => seq.next())).not.toThrow();
    const one = new Sequencer(buildPool(['G'], [1]), 3);
    expect(one.next().id).toBe(one.next().id);
  });
});

describe('scoring', () => {
  it('scores hits inside the window and misses outside it', () => {
    const times = targetTimes(0, 60, 4, 16); // 4 targets at 4, 8, 12, 16 s
    expect(times).toEqual([4, 8, 12, 16]);
    const g = new GameScorer(times, ['G@1', 'C@1', 'D@1', 'G@1'], 0.1);
    expect(g.strum(4.05, 'G@1', true)?.index).toBe(0);
    expect(g.strum(4.06, 'G@1', true)).toBeNull(); // already hit
    expect(g.strum(8.2, 'C@1', true)).toBeNull(); // late
    expect(g.strum(12.0, 'D@1', false)).toBeNull(); // wrong chord
    expect(g.strum(15.95, 'G@1', true)?.index).toBe(3);
    expect(g.expire(20, 0.3).map((t) => t.index)).toEqual([1, 2]);
    expect([g.hits, g.misses, g.score, g.done]).toEqual([2, 2, 0, true]);
  });
});
