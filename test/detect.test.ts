import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audio/analyzer';
import { judge } from '../src/audio/matcher';
import { ALL_VOICINGS, CHORD_BY_ID } from '../src/music/library';
import { SR, strum, windowAfter } from './synth';

const run = (midis: number[], seed = 1, drone = true) => analyze(windowAfter(strum(midis, { seed, drone }), 0.1), SR);

describe('detector on synthesized strums', () => {
  it('identifies the chord for every voicing in the library', () => {
    const misses: string[] = [];
    for (const v of ALL_VOICINGS) {
      const j = judge(run(v.midi, v.position), v, { checkPosition: false, minScore: 0.6, positionTolerance: 0.015 });
      if (j.verdict !== 'correct') misses.push(`${v.id} [${v.frets}] heard ${j.heard} (${j.score.toFixed(2)})`);
    }
    console.log(`chord misses: ${misses.length}/${ALL_VOICINGS.length}`, misses.slice(0, 20));
    expect(misses.length / ALL_VOICINGS.length).toBeLessThan(0.03);
  });

  it('usually identifies the position', () => {
    const misses: string[] = [];
    for (const v of ALL_VOICINGS) {
      const j = judge(run(v.midi, v.position + 7), v);
      if (j.verdict !== 'correct') misses.push(`${v.id} [${v.frets}] → pos ${j.heardPosition} (${j.verdict})`);
    }
    console.log(`position misses: ${misses.length}/${ALL_VOICINGS.length}`, misses.slice(0, 20));
    expect(misses.length / ALL_VOICINGS.length).toBeLessThan(0.1);
  });

  it('works without the 5th string', () => {
    let ok = 0;
    for (const v of ALL_VOICINGS) if (judge(run(v.midi, 3, false), v, { checkPosition: false, minScore: 0.6, positionTolerance: 0.015 }).verdict === 'correct') ok++;
    expect(ok / ALL_VOICINGS.length).toBeGreaterThan(0.95);
  });

  it('rejects the wrong chord and the wrong position', () => {
    const g1 = CHORD_BY_ID['G'].voicings[0];
    const c1 = CHORD_BY_ID['C'].voicings[0];
    expect(judge(run(c1.midi), g1).verdict).toBe('wrongChord');
    const d = CHORD_BY_ID['D'].voicings;
    const j = judge(run(d.find((v) => v.frets.join() === '12,11,10,12')!.midi), d.find((v) => v.frets.join() === '7,7,7,7')!);
    expect(j.verdict).toBe('wrongPosition');
  });

  it('calls silence unclear', () => {
    const silence = new Float32Array(SR * 0.4).map(() => (Math.random() - 0.5) * 0.001);
    expect(judge(analyze(silence, SR), CHORD_BY_ID['G'].voicings[0]).verdict).not.toBe('correct');
  });
});
